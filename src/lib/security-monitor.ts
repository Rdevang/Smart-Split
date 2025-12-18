/**
 * Security Monitoring System
 * 
 * Provides:
 * 1. Failed login attempt tracking and lockout
 * 2. Anomaly detection for API usage
 * 3. Security event alerting
 * 4. IP-based threat detection
 */

import { getRedis, recordFailure, recordSuccess } from "./redis";
import { logger, SecurityEvents, type SecurityEventType } from "./logger";

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Failed login tracking
    MAX_FAILED_LOGINS: 5,              // Lock after 5 failed attempts
    FAILED_LOGIN_WINDOW: 15 * 60,      // 15 minute window
    LOCKOUT_DURATION: 30 * 60,         // 30 minute lockout
    
    // Rate anomaly detection
    ANOMALY_THRESHOLD_MULTIPLIER: 3,   // 3x normal rate = anomaly
    ANOMALY_WINDOW: 60,                // 1 minute window for rate calculation
    
    // Alert thresholds
    ALERT_THRESHOLD_HIGH: 10,          // 10+ security events = high alert
    ALERT_THRESHOLD_CRITICAL: 25,      // 25+ security events = critical alert
    ALERT_WINDOW: 5 * 60,              // 5 minute window for alerts
    
    // Suspicious patterns
    SUSPICIOUS_USER_AGENTS: [
        "curl",
        "wget",
        "python-requests",
        "go-http-client",
        "scrapy",
        "bot",
        "crawler",
        "spider",
    ],
    
    // Known bad IPs (would typically come from a threat intelligence feed)
    // This is just a placeholder - in production, use a service like Cloudflare or AWS WAF
    BLOCKED_IP_PREFIXES: [] as string[],
};

// ============================================
// TYPES
// ============================================

export interface SecurityAlert {
    id: string;
    type: "warning" | "high" | "critical";
    event: SecurityEventType;
    message: string;
    count: number;
    timestamp: string;
    source?: string;
    metadata?: Record<string, unknown>;
}

export interface LoginAttemptResult {
    allowed: boolean;
    remainingAttempts?: number;
    lockoutEndsAt?: Date;
    reason?: string;
}

export interface AnomalyResult {
    isAnomaly: boolean;
    currentRate: number;
    normalRate: number;
    factor: number;
}

// ============================================
// FAILED LOGIN TRACKING
// ============================================

/**
 * Track a failed login attempt
 * Returns whether the account should be locked
 */
export async function trackFailedLogin(
    identifier: string, // email or user ID
    ipAddress?: string
): Promise<LoginAttemptResult> {
    const redis = getRedis();
    
    // Log the security event
    logger.security(
        SecurityEvents.LOGIN_FAILURE,
        "medium",
        "failure",
        { identifier: identifier.replace(/(.{3}).*@/, "$1***@"), ipAddress }
    );
    
    if (!redis) {
        // Without Redis, we can't track - allow but log warning
        logger.warn("Failed login tracking disabled - Redis not available");
        return { allowed: true };
    }
    
    try {
        const userKey = `security:failed_login:user:${identifier}`;
        const ipKey = ipAddress ? `security:failed_login:ip:${ipAddress}` : null;
        
        // Check if already locked out
        const lockoutKey = `security:lockout:${identifier}`;
        const lockoutEnd = await redis.get<string>(lockoutKey);
        
        if (lockoutEnd) {
            const endsAt = new Date(lockoutEnd);
            if (endsAt > new Date()) {
                logger.security(
                    SecurityEvents.LOGIN_BLOCKED,
                    "high",
                    "blocked",
                    { identifier, reason: "Account locked", lockoutEndsAt: endsAt }
                );
                return {
                    allowed: false,
                    lockoutEndsAt: endsAt,
                    reason: "Account temporarily locked due to too many failed attempts",
                };
            }
        }
        
        // Increment failed attempts
        const pipeline = redis.pipeline();
        pipeline.incr(userKey);
        pipeline.expire(userKey, CONFIG.FAILED_LOGIN_WINDOW);
        
        if (ipKey) {
            pipeline.incr(ipKey);
            pipeline.expire(ipKey, CONFIG.FAILED_LOGIN_WINDOW);
        }
        
        const results = await pipeline.exec();
        const userAttempts = results[0] as number;
        
        // Check if should lock out
        if (userAttempts >= CONFIG.MAX_FAILED_LOGINS) {
            const lockoutEnd = new Date(Date.now() + CONFIG.LOCKOUT_DURATION * 1000);
            await redis.set(lockoutKey, lockoutEnd.toISOString(), { ex: CONFIG.LOCKOUT_DURATION });
            
            // Clear the counter
            await redis.del(userKey);
            
            logger.security(
                SecurityEvents.ACCOUNT_LOCKED,
                "high",
                "success",
                { identifier, reason: "Too many failed login attempts", lockoutDuration: CONFIG.LOCKOUT_DURATION }
            );
            
            // Trigger alert
            await triggerSecurityAlert({
                type: "high",
                event: SecurityEvents.ACCOUNT_LOCKED,
                message: `Account locked after ${CONFIG.MAX_FAILED_LOGINS} failed login attempts`,
                source: ipAddress,
                metadata: { identifier },
            });
            
            return {
                allowed: false,
                lockoutEndsAt: lockoutEnd,
                reason: "Account temporarily locked due to too many failed attempts",
            };
        }
        
        recordSuccess();
        return {
            allowed: true,
            remainingAttempts: CONFIG.MAX_FAILED_LOGINS - userAttempts,
        };
    } catch (error) {
        recordFailure();
        logger.error("Failed to track login attempt", error as Error);
        return { allowed: true }; // Fail open
    }
}

/**
 * Clear failed login attempts on successful login
 */
export async function clearFailedLogins(identifier: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    
    try {
        const userKey = `security:failed_login:user:${identifier}`;
        const lockoutKey = `security:lockout:${identifier}`;
        
        await redis.del(userKey, lockoutKey);
        
        logger.security(
            SecurityEvents.LOGIN_SUCCESS,
            "low",
            "success",
            { identifier }
        );
        
        recordSuccess();
    } catch (error) {
        recordFailure();
        logger.error("Failed to clear login attempts", error as Error);
    }
}

/**
 * Check if an account is locked
 */
export async function isAccountLocked(identifier: string): Promise<LoginAttemptResult> {
    const redis = getRedis();
    if (!redis) return { allowed: true };
    
    try {
        const lockoutKey = `security:lockout:${identifier}`;
        const lockoutEnd = await redis.get<string>(lockoutKey);
        
        if (lockoutEnd) {
            const endsAt = new Date(lockoutEnd);
            if (endsAt > new Date()) {
                return {
                    allowed: false,
                    lockoutEndsAt: endsAt,
                    reason: "Account temporarily locked",
                };
            }
        }
        
        recordSuccess();
        return { allowed: true };
    } catch (error) {
        recordFailure();
        return { allowed: true }; // Fail open
    }
}

// ============================================
// ANOMALY DETECTION
// ============================================

/**
 * Track API request rate for anomaly detection
 */
export async function trackRequestRate(
    identifier: string, // user ID or IP
    endpoint: string
): Promise<AnomalyResult> {
    const redis = getRedis();
    
    if (!redis) {
        return { isAnomaly: false, currentRate: 0, normalRate: 0, factor: 0 };
    }
    
    try {
        const currentKey = `security:rate:current:${identifier}:${endpoint}`;
        const baselineKey = `security:rate:baseline:${identifier}:${endpoint}`;
        
        // Increment current rate
        const pipeline = redis.pipeline();
        pipeline.incr(currentKey);
        pipeline.expire(currentKey, CONFIG.ANOMALY_WINDOW);
        pipeline.get(baselineKey);
        
        const results = await pipeline.exec();
        const currentRate = results[0] as number;
        const baselineRate = parseFloat(results[2] as string || "10"); // Default baseline of 10 req/min
        
        // Check for anomaly
        const factor = currentRate / baselineRate;
        const isAnomaly = factor >= CONFIG.ANOMALY_THRESHOLD_MULTIPLIER;
        
        if (isAnomaly) {
            logger.security(
                SecurityEvents.SUSPICIOUS_PATTERN,
                "medium",
                "blocked",
                { 
                    identifier, 
                    endpoint, 
                    currentRate, 
                    baselineRate, 
                    factor: factor.toFixed(2) 
                }
            );
            
            // Trigger alert if severe
            if (factor >= CONFIG.ANOMALY_THRESHOLD_MULTIPLIER * 2) {
                await triggerSecurityAlert({
                    type: "high",
                    event: SecurityEvents.SUSPICIOUS_PATTERN,
                    message: `Anomalous request rate detected: ${factor.toFixed(1)}x normal`,
                    source: identifier,
                    metadata: { endpoint, currentRate, baselineRate },
                });
            }
        }
        
        // Update baseline (exponential moving average)
        const newBaseline = baselineRate * 0.9 + currentRate * 0.1;
        await redis.set(baselineKey, newBaseline.toString(), { ex: 86400 }); // 24 hour retention
        
        recordSuccess();
        return { isAnomaly, currentRate, normalRate: baselineRate, factor };
    } catch (error) {
        recordFailure();
        logger.error("Failed to track request rate", error as Error);
        return { isAnomaly: false, currentRate: 0, normalRate: 0, factor: 0 };
    }
}

/**
 * Detect brute force attacks
 */
export async function detectBruteForce(
    ipAddress: string,
    endpoint: string
): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    
    try {
        const key = `security:bruteforce:${ipAddress}:${endpoint}`;
        
        const pipeline = redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, 60); // 1 minute window
        
        const results = await pipeline.exec();
        const count = results[0] as number;
        
        // More than 30 requests to same endpoint from same IP in 1 minute = brute force
        if (count > 30) {
            logger.security(
                SecurityEvents.BRUTE_FORCE_DETECTED,
                "critical",
                "blocked",
                { ipAddress, endpoint, requestCount: count }
            );
            
            await triggerSecurityAlert({
                type: "critical",
                event: SecurityEvents.BRUTE_FORCE_DETECTED,
                message: `Brute force attack detected from IP`,
                source: ipAddress,
                metadata: { endpoint, requestCount: count },
            });
            
            return true;
        }
        
        recordSuccess();
        return false;
    } catch (error) {
        recordFailure();
        return false;
    }
}

// ============================================
// SUSPICIOUS PATTERN DETECTION
// ============================================

/**
 * Check if user agent looks suspicious
 */
export function isSuspiciousUserAgent(userAgent: string | null): boolean {
    if (!userAgent) return true; // Missing user agent is suspicious
    
    const lowerUA = userAgent.toLowerCase();
    
    return CONFIG.SUSPICIOUS_USER_AGENTS.some(pattern => 
        lowerUA.includes(pattern.toLowerCase())
    );
}

/**
 * Check if IP is in blocked list
 */
export function isBlockedIP(ipAddress: string): boolean {
    return CONFIG.BLOCKED_IP_PREFIXES.some(prefix => 
        ipAddress.startsWith(prefix)
    );
}

/**
 * Analyze request for suspicious patterns
 */
export async function analyzeRequest(params: {
    ipAddress: string;
    userAgent: string | null;
    path: string;
    method: string;
    userId?: string;
}): Promise<{
    suspicious: boolean;
    reasons: string[];
    shouldBlock: boolean;
}> {
    const reasons: string[] = [];
    let shouldBlock = false;
    
    // Check user agent
    if (isSuspiciousUserAgent(params.userAgent)) {
        reasons.push("Suspicious user agent");
        
        logger.security(
            SecurityEvents.SUSPICIOUS_USER_AGENT,
            "low",
            "success",
            { userAgent: params.userAgent, ipAddress: params.ipAddress }
        );
    }
    
    // Check blocked IPs
    if (isBlockedIP(params.ipAddress)) {
        reasons.push("IP in block list");
        shouldBlock = true;
        
        logger.security(
            SecurityEvents.SUSPICIOUS_IP,
            "high",
            "blocked",
            { ipAddress: params.ipAddress }
        );
    }
    
    // Check for brute force
    const isBruteForce = await detectBruteForce(params.ipAddress, params.path);
    if (isBruteForce) {
        reasons.push("Brute force pattern detected");
        shouldBlock = true;
    }
    
    // Check for anomalous rate
    const identifier = params.userId || params.ipAddress;
    const anomaly = await trackRequestRate(identifier, params.path);
    if (anomaly.isAnomaly) {
        reasons.push(`Anomalous request rate (${anomaly.factor.toFixed(1)}x normal)`);
        if (anomaly.factor >= CONFIG.ANOMALY_THRESHOLD_MULTIPLIER * 2) {
            shouldBlock = true;
        }
    }
    
    return {
        suspicious: reasons.length > 0,
        reasons,
        shouldBlock,
    };
}

// ============================================
// SECURITY ALERTING
// ============================================

// In-memory alert buffer for deduplication
const alertBuffer = new Map<string, { count: number; lastSent: number }>();

/**
 * Trigger a security alert
 * Includes deduplication to prevent alert fatigue
 */
export async function triggerSecurityAlert(params: {
    type: "warning" | "high" | "critical";
    event: SecurityEventType;
    message: string;
    source?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const redis = getRedis();
    const alertKey = `${params.event}:${params.source || "global"}`;
    
    // Check deduplication
    const existing = alertBuffer.get(alertKey);
    const now = Date.now();
    
    if (existing && now - existing.lastSent < CONFIG.ALERT_WINDOW * 1000) {
        // Update count but don't send
        existing.count++;
        alertBuffer.set(alertKey, existing);
        return;
    }
    
    // Create alert
    const alert: SecurityAlert = {
        id: `alert_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        type: params.type,
        event: params.event,
        message: params.message,
        count: existing?.count || 1,
        timestamp: new Date().toISOString(),
        source: params.source,
        metadata: params.metadata,
    };
    
    // Log the alert
    logger.security(
        params.event,
        params.type === "critical" ? "critical" : params.type === "high" ? "high" : "medium",
        "success",
        { alert }
    );
    
    // Store in Redis for retrieval
    if (redis) {
        try {
            const alertListKey = "security:alerts:recent";
            await redis.lpush(alertListKey, JSON.stringify(alert));
            await redis.ltrim(alertListKey, 0, 99); // Keep last 100 alerts
            await redis.expire(alertListKey, 86400); // 24 hour retention
            recordSuccess();
        } catch (error) {
            recordFailure();
        }
    }
    
    // Update buffer
    alertBuffer.set(alertKey, { count: 1, lastSent: now });
    
    // In production, you would integrate with:
    // - PagerDuty, OpsGenie, or similar for critical alerts
    // - Slack/Teams webhooks for high alerts
    // - Email for warning alerts
    
    // Example webhook integration (disabled by default)
    if (process.env.SECURITY_WEBHOOK_URL && params.type === "critical") {
        try {
            await fetch(process.env.SECURITY_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: `🚨 Security Alert: ${params.message}`,
                    ...alert,
                }),
            });
        } catch (error) {
            logger.error("Failed to send security webhook", error as Error);
        }
    }
}

/**
 * Get recent security alerts
 */
export async function getRecentAlerts(limit: number = 20): Promise<SecurityAlert[]> {
    const redis = getRedis();
    if (!redis) return [];
    
    try {
        const alertListKey = "security:alerts:recent";
        const alerts = await redis.lrange(alertListKey, 0, limit - 1);
        
        recordSuccess();
        return alerts.map(a => JSON.parse(a as string) as SecurityAlert);
    } catch (error) {
        recordFailure();
        return [];
    }
}

// ============================================
// SECURITY METRICS
// ============================================

/**
 * Get security metrics summary
 */
export async function getSecurityMetrics(): Promise<{
    failedLogins24h: number;
    lockedAccounts: number;
    alertsTriggered24h: number;
    anomaliesDetected24h: number;
}> {
    const redis = getRedis();
    
    if (!redis) {
        return {
            failedLogins24h: 0,
            lockedAccounts: 0,
            alertsTriggered24h: 0,
            anomaliesDetected24h: 0,
        };
    }
    
    try {
        // These would be populated by your metrics collection
        // For now, return estimates based on alert count
        const alerts = await getRecentAlerts(100);
        
        const failedLoginAlerts = alerts.filter(a => 
            a.event === SecurityEvents.LOGIN_FAILURE
        ).length;
        
        const lockedAccountAlerts = alerts.filter(a => 
            a.event === SecurityEvents.ACCOUNT_LOCKED
        ).length;
        
        const anomalyAlerts = alerts.filter(a => 
            a.event === SecurityEvents.SUSPICIOUS_PATTERN
        ).length;
        
        recordSuccess();
        return {
            failedLogins24h: failedLoginAlerts * 5, // Estimate
            lockedAccounts: lockedAccountAlerts,
            alertsTriggered24h: alerts.length,
            anomaliesDetected24h: anomalyAlerts,
        };
    } catch (error) {
        recordFailure();
        return {
            failedLogins24h: 0,
            lockedAccounts: 0,
            alertsTriggered24h: 0,
            anomaliesDetected24h: 0,
        };
    }
}

export default {
    trackFailedLogin,
    clearFailedLogins,
    isAccountLocked,
    trackRequestRate,
    detectBruteForce,
    analyzeRequest,
    triggerSecurityAlert,
    getRecentAlerts,
    getSecurityMetrics,
    isSuspiciousUserAgent,
    isBlockedIP,
};

