# 🔐 Stored Procedures Security Review Checklist

**Last Review:** December 18, 2024  
**Next Review:** January 18, 2025 (Monthly)  
**Reviewer:** Security Team

---

## 📋 Review Schedule

| Frequency | Review Type |
|-----------|-------------|
| Weekly | New procedures added in sprint |
| Monthly | Full review of all procedures |
| Quarterly | Third-party security audit |
| On-change | Any modification to existing procedures |

---

## ✅ Security Checklist for Each Procedure

### 1. Input Validation
- [ ] All parameters validated for type
- [ ] All parameters validated for length/range
- [ ] NULL values handled explicitly
- [ ] No dynamic SQL from user input
- [ ] UUID formats validated

### 2. Authorization
- [ ] SECURITY DEFINER used appropriately (or INVOKER if no elevation needed)
- [ ] Caller's permissions checked within function
- [ ] RLS policies respected (not bypassed unless intentional)
- [ ] Only necessary tables accessed

### 3. SQL Injection Prevention
- [ ] No string concatenation with user input
- [ ] EXECUTE FORMAT used correctly with %I/%L
- [ ] Prepared statements where applicable
- [ ] Input sanitized before use in dynamic queries

### 4. Information Disclosure
- [ ] Error messages don't reveal schema details
- [ ] RAISE NOTICE not exposing sensitive data in production
- [ ] Return values don't leak unauthorized data

### 5. Performance & DoS
- [ ] Limits on rows returned
- [ ] Timeouts configured where appropriate
- [ ] No infinite loops possible
- [ ] Indexes exist for queried columns

### 6. Audit & Logging
- [ ] Critical operations logged to audit_logs
- [ ] User ID captured for accountability
- [ ] Timestamps recorded

---

## 📝 Current Stored Procedures

### `get_group_balances(group_uuid UUID)`

**Purpose:** Calculate balances for all members in a group

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ✅ | UUID type enforced |
| Authorization | ✅ | Uses SECURITY DEFINER, RLS applied in calling context |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Returns only balance data |
| Performance | ⚠️ | Consider adding LIMIT for very large groups |
| Audit | ⚠️ | Not logged (read-only, acceptable) |

**Code Review Notes:**
```sql
-- Good: Type-safe parameter
CREATE OR REPLACE FUNCTION get_group_balances(group_uuid UUID)

-- Good: Explicit NULL handling
COALESCE(SUM(amount), 0)

-- Good: No string concatenation
WHERE group_id = group_uuid
```

---

### `soft_delete_expense(expense_uuid UUID)`

**Purpose:** Soft delete an expense by setting deleted_at

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ✅ | UUID type enforced |
| Authorization | ✅ | RLS ensures caller can only delete their expenses |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Void return type |
| Performance | ✅ | Single row update |
| Audit | ✅ | Triggers log to audit_logs |

---

### `soft_delete_group(group_uuid UUID)`

**Purpose:** Soft delete a group and cascade to expenses

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ✅ | UUID type enforced |
| Authorization | ✅ | RLS ensures only admins can delete |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Void return type |
| Performance | ⚠️ | Cascades to all expenses - monitor for large groups |
| Audit | ✅ | Triggers log to audit_logs |

---

### `restore_group(group_uuid UUID)`

**Purpose:** Restore a soft-deleted group

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ✅ | UUID type enforced |
| Authorization | ✅ | RLS ensures only admins can restore |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Returns BOOLEAN |
| Performance | ✅ | Single row update |
| Audit | ✅ | Triggers log to audit_logs |

---

### `generate_invite_code()`

**Purpose:** Generate unique 8-character alphanumeric invite code

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | N/A | No parameters |
| Authorization | ✅ | Only called during group creation |
| SQL Injection | ✅ | No user input |
| Info Disclosure | ✅ | Returns only code |
| Performance | ✅ | Cryptographically random, efficient |
| Audit | N/A | Not needed for code generation |

**Security Strength:**
- Uses `gen_random_bytes()` for cryptographic randomness
- 8 characters from 36-char alphabet = ~2.8 trillion combinations
- Loop ensures uniqueness

---

### `join_group_by_invite_code(code TEXT, uid UUID)`

**Purpose:** Add user to group via invite code

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ⚠️ | Code should be validated for length/format |
| Authorization | ✅ | Any authenticated user can join |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Returns UUID or NULL |
| Performance | ✅ | Uses indexed lookup |
| Audit | ✅ | Activity logged |

**Recommendation:** Add code format validation:
```sql
-- Add at start of function
IF LENGTH(code) != 8 OR code !~ '^[A-Z0-9]+$' THEN
    RETURN NULL;
END IF;
```

---

### `cleanup_deleted_records()`

**Purpose:** Permanently delete records older than 30 days

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | N/A | No parameters |
| Authorization | ✅ | Should only be called by scheduled job |
| SQL Injection | ✅ | No user input |
| Info Disclosure | ✅ | Returns count only |
| Performance | ⚠️ | Consider batching for large datasets |
| Audit | ⚠️ | Consider logging permanent deletions |

---

### `is_group_member(gid UUID, uid UUID)`

**Purpose:** Check if user is member of group (for RLS)

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ✅ | UUID types enforced |
| Authorization | ✅ | SECURITY DEFINER to bypass RLS recursion |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Returns only boolean |
| Performance | ✅ | Simple EXISTS check |
| Audit | N/A | Helper function, high frequency |

---

### `is_group_admin(gid UUID, uid UUID)`

**Purpose:** Check if user is admin of group (for RLS)

**Security Status:** ✅ Reviewed (Dec 18, 2024)

| Check | Status | Notes |
|-------|--------|-------|
| Input Validation | ✅ | UUID types enforced |
| Authorization | ✅ | SECURITY DEFINER to bypass RLS recursion |
| SQL Injection | ✅ | No dynamic SQL |
| Info Disclosure | ✅ | Returns only boolean |
| Performance | ✅ | Simple EXISTS check |
| Audit | N/A | Helper function, high frequency |

---

## 🚨 Security Incidents & Learnings

### Dec 2024: RLS Infinite Recursion
**Issue:** `is_group_member` caused infinite recursion when used in RLS policy  
**Fix:** Changed to `SECURITY DEFINER` to bypass RLS during check  
**Prevention:** Always use SECURITY DEFINER for RLS helper functions

---

## 📊 Summary

| Total Procedures | Reviewed | Issues Found | Critical |
|------------------|----------|--------------|----------|
| 10 | 10 | 2 | 0 |

### Open Issues
1. **join_group_by_invite_code** - Add input validation for code format
2. **cleanup_deleted_records** - Consider logging permanent deletions

---

## 🔄 Review Process

1. **Before Deployment:**
   - [ ] All new procedures reviewed against checklist
   - [ ] Tests written for edge cases
   - [ ] Security team sign-off

2. **Monthly Review:**
   - [ ] Re-review all procedures against checklist
   - [ ] Check for new SQL injection techniques
   - [ ] Update documentation

3. **After Incident:**
   - [ ] Root cause analysis
   - [ ] Update procedures if needed
   - [ ] Add to learnings section

---

## 📚 References

- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

*This document must be updated after each security review or procedure change.*

