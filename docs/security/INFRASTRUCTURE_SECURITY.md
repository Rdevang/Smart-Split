# 🛡️ Infrastructure Security Configuration

**Last Updated:** December 18, 2024  
**Application:** Smart Split  
**Stack:** Vercel + Supabase + Upstash Redis

This document covers the infrastructure-level security configurations for Smart Split.

---

## 📊 Quick Status

| Component | Status | Provider |
|-----------|--------|----------|
| WAF Rules | ✅ Configured | Vercel |
| DDoS Protection | ✅ Enabled | Vercel Edge + Rate Limiting |
| Supabase Security | ✅ Configured | Supabase Dashboard |
| Bot Protection | ✅ Active | Vercel + Custom Rules |

---

## 1. Supabase Security Configuration

### 1.1 Authentication Settings

Configure in **Supabase Dashboard → Authentication → Settings**:

#### Email Settings
```
✅ Enable email confirmations: ON
✅ Secure email change: ON (requires verification for email changes)
✅ Double confirm email changes: ON
```

#### Security Settings
```
✅ Enable CAPTCHA protection: ON (hCaptcha or Turnstile)
✅ Minimum password length: 8 characters
✅ Leaked password protection: ON
```

#### Session Settings
```
✅ JWT expiry: 3600 seconds (1 hour)
✅ Refresh token rotation: ON
✅ Refresh token reuse interval: 10 seconds
✅ Inactivity timeout: 24 hours
```

### 1.2 Database Security

#### Row Level Security (RLS)
```sql
-- Verify RLS is enabled on ALL tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- All should show rowsecurity = true
```

#### Connection Pooling
```
Mode: Transaction (recommended for serverless)
Pool size: Based on plan limits
```

### 1.3 API Security

#### API Rate Limiting (Supabase Dashboard → Project Settings → API)
```
✅ Enable rate limiting: ON
✅ Requests per second: 100 (adjust based on usage)
✅ Enable email rate limiting: ON (4 emails per hour per user)
```

#### API Keys
```
✅ Rotate anon key: Every 90 days
✅ Never expose service_role key in client code
✅ Use RLS instead of service_role where possible
```

### 1.4 Supabase Security Checklist

```markdown
## Supabase Dashboard Configuration

### Authentication → Providers
- [x] Disable unused providers
- [x] Configure OAuth redirect URLs (production only)
- [x] Set up provider-specific security (Google, GitHub)

### Authentication → URL Configuration
- [x] Site URL: https://smart-split-one.vercel.app
- [x] Redirect URLs: Only allow production domains

### Authentication → Email Templates
- [x] Customize email templates (no sensitive info)
- [x] Use branded sender address

### Database → Roles
- [x] Review default roles
- [x] Limit service_role usage to server-side only

### Storage → Policies
- [x] RLS on all buckets
- [x] File size limits configured
- [x] Allowed MIME types restricted

### Edge Functions (if used)
- [x] JWT verification enabled
- [x] CORS configured correctly

### Logs
- [x] Enable Postgres logs
- [x] Enable Auth logs
- [x] Set up log exports (optional)
```

---

## 2. Vercel WAF Configuration

### 2.1 Firewall Rules (vercel.json)

The following rules are configured in `vercel.json`:

```json
{
  "security": {
    "attackChallengeMode": "enabled",
    "managedRuleset": "strict"
  }
}
```

### 2.2 Bot Protection

Configured via Vercel Dashboard → Project → Settings → Security:

| Rule | Action | Description |
|------|--------|-------------|
| Known Bad Bots | Block | Blocks known malicious bots |
| Automated Traffic | Challenge | CAPTCHA for suspicious automated requests |
| Headless Browsers | Challenge | Challenge requests from headless browsers |
| Scraping Bots | Rate Limit | Limit scraping attempts |

### 2.3 IP Blocking

Configure in Vercel Dashboard for known malicious IPs:

```
Rules:
1. Block IPs from abuse lists
2. Block TOR exit nodes (if required)
3. Geo-blocking for unused regions (optional)
```

### 2.4 Request Inspection Rules

```json
{
  "firewall": {
    "rules": [
      {
        "name": "Block SQL Injection Attempts",
        "conditions": {
          "query": {
            "contains": ["SELECT", "UNION", "DROP", "--", "/*"]
          }
        },
        "action": "block"
      },
      {
        "name": "Block XSS Attempts",
        "conditions": {
          "query": {
            "contains": ["<script>", "javascript:", "onerror=", "onload="]
          }
        },
        "action": "block"
      },
      {
        "name": "Block Path Traversal",
        "conditions": {
          "path": {
            "contains": ["../", "..\\", "%2e%2e"]
          }
        },
        "action": "block"
      }
    ]
  }
}
```

---

## 3. DDoS Protection

### 3.1 Multi-Layer Protection Strategy

```
Layer 1: Vercel Edge Network
├── Global CDN absorbs volumetric attacks
├── Automatic traffic analysis
└── Edge rate limiting

Layer 2: Application Rate Limiting (Implemented)
├── Redis-based rate limiting
├── In-memory fallback
├── Path-specific limits
└── IP-based tracking

Layer 3: Supabase Protection
├── Connection pooling limits
├── API rate limiting
└── Row-level security
```

### 3.2 Rate Limiting Configuration (Already Implemented)

From `src/lib/rate-limit.ts`:

```typescript
export const RateLimitConfig = {
    api: { requests: 100, window: "1 m" },      // General API
    auth: { requests: 10, window: "15 m" },     // Auth endpoints
    sensitive: { requests: 5, window: "1 h" },   // Sensitive operations
    financial: { requests: 20, window: "1 h" },  // Settlements
    write: { requests: 50, window: "1 h" },      // Write operations
    invite: { requests: 20, window: "1 h" },     // Invite operations
};
```

### 3.3 Emergency Response Plan

```markdown
## DDoS Attack Response Procedure

### Detection
1. Monitor Vercel Analytics for traffic spikes
2. Check rate limit metrics (/api/security/metrics)
3. Review Redis rate limit counters

### Immediate Response
1. Enable Vercel Attack Challenge Mode (Dashboard)
2. Increase rate limiting strictness
3. Block suspicious IPs/regions if identifiable

### Escalation
1. Contact Vercel support for enterprise-level mitigation
2. Enable additional Cloudflare protection (if configured)
3. Temporarily disable non-essential features
```

---

## 4. Vercel Security Configuration

### 4.1 Environment Variables Security

```markdown
## Environment Variable Best Practices

### Required Variables
- NEXT_PUBLIC_SUPABASE_URL - Public (ok to expose)
- NEXT_PUBLIC_SUPABASE_ANON_KEY - Public (ok to expose)
- NEXT_PUBLIC_SITE_URL - Public (ok to expose)
- UPSTASH_REDIS_REST_URL - Server-only (NEVER expose)
- UPSTASH_REDIS_REST_TOKEN - Server-only (NEVER expose)

### Variable Scoping
- Production: All variables set
- Preview: Separate variables for staging Supabase
- Development: Local .env.local file

### Rotation Schedule
- Supabase keys: 90 days
- Upstash tokens: 90 days
- Review access: Monthly
```

### 4.2 Deployment Protection

Configure in Vercel Dashboard:

```
✅ Vercel Authentication: ON for preview deployments
✅ Password Protection: OFF (use auth instead)
✅ Trusted IPs: Configure for preview if needed
✅ Deployment Protection Bypass: Disabled
```

### 4.3 Security Headers (Already Implemented)

From `next.config.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-XSS-Protection | 1; mode=block | XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer |
| Permissions-Policy | camera=(self), microphone=()... | Limit APIs |
| Content-Security-Policy | Comprehensive policy | XSS prevention |

---

## 5. Monitoring & Alerting

### 5.1 Security Metrics Endpoint

`GET /api/security/metrics` provides:

```json
{
  "metrics": {
    "failedLogins": { "count": 0, "threshold": 10 },
    "rateLimitHits": { "count": 0, "threshold": 100 },
    "suspiciousRequests": { "count": 0, "threshold": 50 }
  },
  "alerts": []
}
```

### 5.2 Vercel Analytics

Monitor in Vercel Dashboard → Analytics:

- Request volume trends
- Error rate spikes
- Geographic distribution anomalies
- Response time degradation

### 5.3 Supabase Monitoring

Monitor in Supabase Dashboard → Reports:

- Database connections
- API requests
- Auth events
- Storage usage

### 5.4 Alert Configuration

```markdown
## Recommended Alerts

### Critical (Page immediately)
- Error rate > 5%
- Response time > 5s (p99)
- Failed logins > 100/hour
- Rate limit hits > 1000/hour

### Warning (Slack notification)
- Error rate > 1%
- Response time > 2s (p95)
- Failed logins > 50/hour
- Unusual geographic patterns
```

---

## 6. Compliance & Audit

### 6.1 Security Audit Schedule

| Audit Type | Frequency | Last Completed |
|------------|-----------|----------------|
| Dependency audit (`npm audit`) | Weekly | Automated |
| RLS policy review | Monthly | Dec 2024 |
| Access key rotation | Quarterly | Dec 2024 |
| Full security audit | Bi-annually | Dec 2024 |

### 6.2 Compliance Checklist

```markdown
## Data Protection
- [x] User data encrypted at rest (Supabase)
- [x] Data encrypted in transit (HTTPS)
- [x] PII redaction in logs
- [x] Soft deletes for data recovery
- [x] Audit logging for sensitive operations

## Access Control
- [x] Role-based access (RLS)
- [x] Session management
- [x] CSRF protection
- [x] Rate limiting

## Incident Response
- [x] Error logging
- [x] Security event tracking
- [x] Alert system
- [ ] Documented incident response plan
```

---

## 7. Quick Setup Commands

### Initial Setup

```bash
# 1. Verify security headers
curl -I https://smart-split-one.vercel.app

# 2. Run dependency audit
npm audit

# 3. Check rate limiting
curl -X GET https://smart-split-one.vercel.app/api/rate-limit/test

# 4. Check cache health (dev only)
curl https://smart-split-one.vercel.app/api/cache/health
```

### Vercel CLI Security Commands

```bash
# View environment variables
vercel env ls

# Add new secret
vercel env add SECRET_NAME production

# Remove compromised secret
vercel env rm SECRET_NAME production

# Redeploy after secret rotation
vercel --prod
```

---

## 📚 References

- [Vercel Security Documentation](https://vercel.com/docs/security)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Cloudflare DDoS Protection](https://www.cloudflare.com/ddos/)

---

*This document should be reviewed and updated quarterly or after any security incident.*

