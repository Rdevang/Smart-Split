# 🔐 Smart Split - Security Checklist

Use this checklist before every release and during code reviews.

---

## Pre-Release Security Checklist

### 🔴 Critical (Block Release)

- [ ] **RLS Enabled** - All tables have Row Level Security enabled
- [ ] **Auth Required** - All protected routes check `supabase.auth.getUser()`
- [ ] **Input Validation** - All user inputs validated with Zod
- [ ] **No Secrets Exposed** - No API keys/secrets in client code
- [ ] **HTTPS Only** - All production traffic over HTTPS

### 🟠 High Priority

- [ ] **Rate Limiting Active** - Auth endpoints have strict rate limits
- [ ] **File Uploads Validated** - MIME type + file size + magic bytes checked
- [ ] **Error Handling** - No stack traces exposed to users
- [ ] **SQL Injection Safe** - No raw SQL, use parameterized queries
- [ ] **XSS Prevention** - No `dangerouslySetInnerHTML` with user content

### 🟡 Medium Priority

- [ ] **Security Headers** - CSP, X-Frame-Options configured
- [ ] **Session Management** - Sessions expire, can be revoked
- [ ] **Password Policy** - Minimum 8 chars, complexity enforced
- [ ] **Audit Logging** - Sensitive operations logged
- [ ] **Dependency Check** - No known vulnerabilities in packages

### 🟢 Best Practices

- [ ] **Generic Errors** - Auth errors don't reveal user existence
- [ ] **CSRF Protection** - Server actions protected
- [ ] **Cache Security** - Sensitive data not cached inappropriately
- [ ] **Logging Clean** - No PII in logs

---

## Code Review Security Checks

### For Every PR

```markdown
## Security Review
- [ ] No hardcoded secrets
- [ ] User input validated before use
- [ ] Authorization checked before data access
- [ ] Error messages don't leak info
- [ ] New dependencies scanned for vulnerabilities
```

### Database Changes

```markdown
## Database Security Review
- [ ] RLS policy added for new table
- [ ] Policy tested for all CRUD operations
- [ ] No SELECT * in RLS policies (infinite recursion risk)
- [ ] Indexes don't expose sensitive data
```

### API Endpoints

```markdown
## API Security Review
- [ ] Authentication required (or intentionally public)
- [ ] Rate limiting configured
- [ ] Request body size limited
- [ ] Response doesn't leak sensitive fields
- [ ] Error responses sanitized
```

### File Uploads

```markdown
## Upload Security Review
- [ ] File size limited (< 5MB recommended)
- [ ] MIME type validated
- [ ] Magic bytes verified
- [ ] Filename sanitized
- [ ] Stored outside web root or in secure bucket
```

---

## Quick Security Tests

### Test IDOR Vulnerability
```bash
# 1. Login as User A, get a resource ID
# 2. Login as User B
# 3. Try to access User A's resource

curl -X GET "https://app.com/api/expenses/USER_A_EXPENSE_ID" \
  -H "Authorization: Bearer USER_B_TOKEN"

# Should return 403 Forbidden, not the data
```

### Test Rate Limiting
```bash
# Send 20 rapid requests to auth endpoint
for i in {1..20}; do
  curl -X POST "https://app.com/login" \
    -d '{"email":"test@test.com","password":"wrong"}' &
done

# Should see 429 responses after limit reached
```

### Test Input Validation
```bash
# Send oversized payload
curl -X POST "https://app.com/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"title":"'"$(python3 -c "print('A'*10000)")"'","description":"test","type":"bug_report"}'

# Should return 400 Bad Request
```

### Test XSS
```bash
# Try to inject script in inputs
curl -X POST "https://app.com/api/feedback" \
  -d '{"title":"<script>alert(1)</script>","description":"test","type":"bug_report"}'

# Script should be escaped in database/display
```

---

## Environment Security

### Production Environment
```env
# ✅ Required
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# ✅ Never expose these to client
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only!

# ✅ These are okay for client
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Supabase Security Settings
- [ ] Email confirmations enabled
- [ ] Password minimum length set (8+)
- [ ] JWT expiry configured (1 hour recommended)
- [ ] RLS enabled on all tables
- [ ] Storage policies configured

---

## Incident Response Quick Guide

### If You Suspect a Breach

1. **IMMEDIATELY:**
   - Rotate all API keys
   - Invalidate all sessions: `supabase.auth.admin.signOut({ scope: 'global' })`
   - Enable Supabase audit logs

2. **WITHIN 1 HOUR:**
   - Review recent database changes
   - Check Vercel/Supabase access logs
   - Document timeline

3. **WITHIN 24 HOURS:**
   - Notify affected users if data exposed
   - Patch vulnerability
   - Post-mortem analysis

---

## Monthly Security Tasks

- [ ] Run `npm audit` - check for vulnerable packages
- [ ] Review Supabase RLS policies
- [ ] Check rate limit effectiveness
- [ ] Review access logs for anomalies
- [ ] Update dependencies
- [ ] Rotate any aging API keys

---

## Security Resources

| Resource | Link |
|----------|------|
| OWASP Cheat Sheets | https://cheatsheetseries.owasp.org |
| Supabase Security | https://supabase.com/docs/guides/auth |
| Next.js Security | https://nextjs.org/docs/advanced-features/security-headers |
| npm audit | Run: `npm audit --production` |

---

*Last Updated: December 17, 2024*

