# Security Update: Removed IP-Based Session Validation

## Date: December 24, 2025

## Problem Fixed
Admin sessions were breaking due to IP-based validation in Docker/proxy/mobile network environments where IP addresses change frequently, causing false "session hijacking" alerts.

## Changes Made

### 1. **Removed IP-Based Session Validation**
- ❌ No longer validates IP address on every request
- ✅ Session validation now relies solely on secure session_id (64-char hex token)
- ✅ Soft User-Agent check (logs warning but doesn't logout)

### 2. **Updated Functions in `routes/auth.js`**

#### `createAdminSession()`
- Removed IP address storage requirement
- Still stores User-Agent for optional soft checking
- Creates cryptographically secure session_id using `crypto.randomBytes(32)`

#### `verifyAdminSession()`
- Removed IP mismatch check (was causing false logouts)
- Removed User-Agent strict check (now soft warning only)
- Session validated by:
  - Valid session_id exists in database
  - Session not expired (24-hour expiry)
  - Admin account still exists

### 3. **Security Features Maintained**

✅ **Secure Session ID**: 64-character hex token (256-bit entropy)
✅ **HttpOnly Cookies**: Prevents XSS attacks
✅ **Secure Flag**: HTTPS-only in production
✅ **SameSite=Strict**: CSRF protection for admin sessions
✅ **Session Expiry**: 24 hours for admin, 90 days for customers
✅ **Single Session**: New login invalidates old sessions
✅ **Server-Side Storage**: Sessions stored in PostgreSQL
✅ **Automatic Cleanup**: Expired sessions deleted on new login

### 4. **What Was NOT Changed**

- Database schema (ip_address column remains for optional logging)
- Customer session logic (unchanged)
- Cookie configuration
- Session expiry times
- All existing routes and endpoints

## Production Deployment

### No Database Migration Required
The `ip_address` column in the `sessions` table can remain as-is. It's simply not used for validation anymore.

### Optional: Clean Existing Sessions (Recommended)
```sql
-- Force all admins to re-login with new secure session logic
DELETE FROM sessions WHERE admin_id IS NOT NULL;
```

### Deployment Steps
1. Deploy updated `routes/auth.js`
2. Restart Node.js server
3. Admins will need to login again (existing sessions remain valid)
4. Monitor logs for any issues

## Testing Checklist

- [x] Admin can login successfully
- [x] Admin session persists across requests
- [x] Admin can access protected routes
- [x] Admin can logout successfully
- [x] Session expires after 24 hours
- [x] New login invalidates old session
- [x] Works behind proxy/load balancer
- [x] Works with changing IP addresses
- [x] No false hijacking alerts

## Security Considerations

### Why This Is Safe

1. **Session ID Entropy**: 256-bit random token is cryptographically secure
2. **HttpOnly + Secure**: Cookie cannot be accessed by JavaScript or sent over HTTP
3. **SameSite=Strict**: Prevents CSRF attacks
4. **Server-Side Validation**: Every request validates against database
5. **Single Session**: Only one active session per admin
6. **Automatic Expiry**: Sessions expire after 24 hours

### Why IP Validation Was Problematic

1. **Docker/Kubernetes**: Container IPs change frequently
2. **Load Balancers**: X-Forwarded-For can vary
3. **Mobile Networks**: Carrier-grade NAT changes IPs
4. **VPN/Proxy**: Users switching networks legitimately
5. **IPv6**: Dynamic address assignment

### Real Hijacking Protection

Session hijacking is prevented by:
- Secure random session_id (impossible to guess)
- HttpOnly cookies (cannot be stolen via XSS)
- HTTPS-only transmission (cannot be intercepted)
- SameSite protection (cannot be sent cross-origin)
- Short expiry time (24 hours)

## Monitoring

Watch for these log messages:
```
Admin session User-Agent changed - Session: abc12345...
```

This indicates a User-Agent change (browser update, different device) but won't cause logout.

## Rollback Plan

If issues occur, revert `routes/auth.js` to previous version:
```bash
git checkout HEAD~1 routes/auth.js
```

## Support

For issues or questions, check:
- Server logs for session errors
- Browser console for cookie issues
- Network tab for failed auth requests
