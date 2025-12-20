# 🧪 Admin Session Security Testing Guide

## 📋 Pre-Testing Setup

### 1. Run Database Migration
```bash
# Connect to your PostgreSQL database
psql -U postgres -d DigiMenu

# Run the migration script
\i migration_admin_sessions.sql

# Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;
```

### 2. Restart Server
```bash
npm start
```

---

## ✅ Test Cases

### Test 1: Admin Login Success
**Endpoint:** `POST /api/auth/admin/login`

**Request:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "admin": {
    "id": 1,
    "username": "admin"
  }
}
```

**Verify:**
- Cookie `adminSessionId` is set (check browser DevTools → Application → Cookies)
- Cookie is `httpOnly`, `secure` (in production), `sameSite=strict`
- Database has new session record:
```sql
SELECT * FROM sessions WHERE admin_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;
```

---

### Test 2: Session Validation
**Endpoint:** `GET /api/auth/admin/session-check`

**Expected Response:**
```json
{
  "authenticated": true,
  "admin": {
    "id": 1,
    "username": "admin"
  }
}
```

**Verify:**
- Session is validated from database
- `last_activity` timestamp is updated in database

---

### Test 3: Access Protected Route
**Endpoint:** `GET /api/admin/dashboard/stats`

**Expected Response:**
```json
{
  "success": true,
  "stats": { ... }
}
```

**Verify:**
- Request succeeds with valid session
- Admin can access all protected routes

---

### Test 4: Invalid Session ID
**Action:** Manually change `adminSessionId` cookie value in browser

**Endpoint:** `GET /api/auth/admin/session-check`

**Expected Response:**
```json
{
  "authenticated": false
}
```

**Verify:**
- Cookie is cleared
- Access to protected routes returns 401

---

### Test 5: Expired Session
**Action:** 
1. Login as admin
2. Manually update session expiry in database:
```sql
UPDATE sessions 
SET expires_at = NOW() - INTERVAL '1 hour' 
WHERE admin_id IS NOT NULL;
```

**Endpoint:** `GET /api/auth/admin/session-check`

**Expected Response:**
```json
{
  "authenticated": false
}
```

**Verify:**
- Expired session is rejected
- Cookie is cleared

---

### Test 6: Session Hijacking Prevention (IP Change)
**Action:**
1. Login as admin from one IP
2. Copy the `adminSessionId` cookie
3. Try to use it from a different IP (use VPN or proxy)

**Endpoint:** `GET /api/auth/admin/session-check`

**Expected Response:**
```json
{
  "authenticated": false
}
```

**Expected Console Log:**
```
⚠️ Admin session hijacking attempt detected! Session IP: 192.168.1.100, Request IP: 203.0.113.50
```

**Verify:**
- Session is deleted from database
- Cookie is cleared
- Warning is logged

---

### Test 7: Session Hijacking Prevention (User-Agent Change)
**Action:**
1. Login as admin from Chrome
2. Copy the `adminSessionId` cookie
3. Try to use it from Firefox (different User-Agent)

**Endpoint:** `GET /api/auth/admin/session-check`

**Expected Response:**
```json
{
  "authenticated": false
}
```

**Expected Console Log:**
```
⚠️ Admin session hijacking attempt detected! User-Agent mismatch for admin 1
```

**Verify:**
- Session is deleted from database
- Cookie is cleared
- Warning is logged

---

### Test 8: Concurrent Session Control
**Action:**
1. Login as admin from Browser A
2. Login as same admin from Browser B

**Verify:**
- Browser A's session is invalidated
- Only Browser B has active session
- Database has only 1 session for this admin:
```sql
SELECT COUNT(*) FROM sessions WHERE admin_id = 1;
-- Should return 1
```

---

### Test 9: Admin Logout
**Endpoint:** `POST /api/auth/admin/logout`

**Expected Response:**
```json
{
  "success": true,
  "message": "Admin logged out successfully"
}
```

**Verify:**
- Session is deleted from database:
```sql
SELECT * FROM sessions WHERE session_id = 'your_session_id';
-- Should return 0 rows
```
- Cookie is cleared
- Access to protected routes returns 401

---

### Test 10: Multiple Admin Sessions
**Action:**
1. Create 2 admin accounts (admin1, admin2)
2. Login as admin1 from Browser A
3. Login as admin2 from Browser B

**Verify:**
- Both admins have separate active sessions
- Database has 2 admin sessions:
```sql
SELECT admin_id, session_id, ip_address, created_at 
FROM sessions 
WHERE admin_id IS NOT NULL;
-- Should return 2 rows
```

---

### Test 11: Session Cleanup
**Action:**
1. Create multiple expired sessions:
```sql
INSERT INTO sessions (session_id, admin_id, ip_address, user_agent, expires_at)
VALUES 
  ('expired1', 1, '127.0.0.1', 'Test', NOW() - INTERVAL '1 day'),
  ('expired2', 1, '127.0.0.1', 'Test', NOW() - INTERVAL '2 days');
```
2. Login as admin (triggers cleanup)

**Verify:**
- Expired sessions are deleted
- Only active session remains:
```sql
SELECT * FROM sessions WHERE admin_id IS NOT NULL;
-- Should return only 1 row (current session)
```

---

### Test 12: Customer Sessions Unaffected
**Action:**
1. Login as customer (OTP-based)
2. Verify customer session works

**Verify:**
- Customer sessions still work normally
- Database has customer session with `customer_id` (not `admin_id`):
```sql
SELECT customer_id, admin_id FROM sessions WHERE customer_id IS NOT NULL;
```

---

### Test 13: Invalid Credentials
**Endpoint:** `POST /api/auth/admin/login`

**Request:**
```json
{
  "username": "admin",
  "password": "wrong_password"
}
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid credentials."
}
```

**Verify:**
- No session created in database
- No cookie set

---

### Test 14: Missing Credentials
**Endpoint:** `POST /api/auth/admin/login`

**Request:**
```json
{
  "username": "admin"
}
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Username and password required."
}
```

---

### Test 15: Deleted Admin Account
**Action:**
1. Login as admin
2. Delete admin from database:
```sql
DELETE FROM admins WHERE admin_id = 1;
```
3. Try to access protected route

**Verify:**
- Session is automatically deleted (CASCADE)
- Access returns 401
- Cookie is cleared

---

## 🔍 Database Verification Queries

### Check Active Admin Sessions
```sql
SELECT 
  s.session_id,
  s.admin_id,
  a.username,
  s.ip_address,
  s.user_agent,
  s.created_at,
  s.last_activity,
  s.expires_at,
  (s.expires_at > NOW()) as is_valid
FROM sessions s
INNER JOIN admins a ON s.admin_id = a.admin_id
WHERE s.admin_id IS NOT NULL
ORDER BY s.created_at DESC;
```

### Check Session Activity
```sql
SELECT 
  admin_id,
  COUNT(*) as session_count,
  MAX(last_activity) as last_seen
FROM sessions
WHERE admin_id IS NOT NULL
GROUP BY admin_id;
```

### Check Expired Sessions
```sql
SELECT COUNT(*) as expired_count
FROM sessions
WHERE expires_at < NOW();
```

---

## 🛡️ Security Checklist

- [ ] Session ID is random and unpredictable (64 hex characters)
- [ ] Session ID is stored in httpOnly cookie (not accessible via JavaScript)
- [ ] Cookie has secure flag in production (HTTPS only)
- [ ] Cookie has sameSite=strict (CSRF protection)
- [ ] Session data stored in database (not in cookie)
- [ ] IP address is validated on every request
- [ ] User-Agent is validated on every request
- [ ] Session expires after 24 hours
- [ ] Expired sessions are cleaned up automatically
- [ ] Only one session per admin (concurrent session control)
- [ ] Session is deleted on logout
- [ ] Session is deleted when admin account is deleted
- [ ] Failed login attempts are logged
- [ ] Session hijacking attempts are logged
- [ ] Customer sessions are unaffected

---

## 📊 Performance Testing

### Load Test: Session Validation
```bash
# Use Apache Bench or similar tool
ab -n 1000 -c 10 -C "adminSessionId=your_session_id" http://localhost:3000/api/auth/admin/session-check
```

**Expected:**
- All requests should complete successfully
- Average response time < 100ms
- No database connection errors

---

## 🐛 Troubleshooting

### Issue: Session not created
**Check:**
- Database migration ran successfully
- `admin_id` column exists in sessions table
- No database connection errors

### Issue: IP mismatch false positives
**Cause:** Proxy or load balancer changing IP
**Solution:** Update `getClientIp()` to handle `X-Forwarded-For` header correctly

### Issue: User-Agent mismatch false positives
**Cause:** Browser updates changing User-Agent
**Solution:** Consider relaxing User-Agent check or using partial matching

---

## 📝 Test Results Template

```
Test Date: _______________
Tester: _______________

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Admin Login Success | ☐ Pass ☐ Fail | |
| 2 | Session Validation | ☐ Pass ☐ Fail | |
| 3 | Access Protected Route | ☐ Pass ☐ Fail | |
| 4 | Invalid Session ID | ☐ Pass ☐ Fail | |
| 5 | Expired Session | ☐ Pass ☐ Fail | |
| 6 | IP Change Detection | ☐ Pass ☐ Fail | |
| 7 | User-Agent Change Detection | ☐ Pass ☐ Fail | |
| 8 | Concurrent Session Control | ☐ Pass ☐ Fail | |
| 9 | Admin Logout | ☐ Pass ☐ Fail | |
| 10 | Multiple Admin Sessions | ☐ Pass ☐ Fail | |
| 11 | Session Cleanup | ☐ Pass ☐ Fail | |
| 12 | Customer Sessions Unaffected | ☐ Pass ☐ Fail | |
| 13 | Invalid Credentials | ☐ Pass ☐ Fail | |
| 14 | Missing Credentials | ☐ Pass ☐ Fail | |
| 15 | Deleted Admin Account | ☐ Pass ☐ Fail | |

Overall Result: ☐ All Pass ☐ Some Failures

Notes:
_______________________________________
_______________________________________
```
