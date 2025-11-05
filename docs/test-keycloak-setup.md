# Testing Keycloak OIDC Integration

This document provides step-by-step instructions for testing the Keycloak OIDC integration.

## Prerequisites

1. **Keycloak Server Running**
   ```bash
   ./podman_run_keycloak.sh
   ```

2. **Environment Configuration**
   ```bash
   cp dotenv-keycloak-sample .env
   # Edit .env with your specific Keycloak configuration
   ```

3. **User Configuration**
   Ensure your `users_config.json` contains users that match Keycloak usernames/emails.

## Keycloak Client Setup

1. **Access Keycloak Admin Console**
   - URL: https://localhost:9443/admin
   - Default credentials: admin/admin

2. **Create/Configure Client**
   - Realm: `hironico.net`
   - Client ID: `account-nico-drive-dev`
   - Client Type: OpenID Connect
   - Access Type: Confidential
   - Valid Redirect URIs: `http://localhost:3000/auth/callback`
   - Web Origins: `http://localhost:3000`
   - Standard Flow Enabled: ON

3. **Get Client Secret**
   - Go to Credentials tab
   - Copy the Client Secret to your `.env` file

## Testing Steps

### 1. Start the Application

```bash
npm run dev
```

### 2. Test Web Authentication Flow

1. **Visit Application**
   ```
   http://localhost:3000
   ```

2. **Expected Behavior**
   - Should redirect to `/login.html`
   - Login page should display
   - Click "Sign in with Keycloak" button
   - Should redirect to Keycloak login page

3. **Login with Keycloak**
   - Enter your Keycloak credentials
   - Should redirect back to application
   - Should see main application interface

### 3. Test Authentication Status

```bash
curl -b cookies.txt -c cookies.txt http://localhost:3000/auth/status
```

Expected response for authenticated user:
```json
{
  "authenticated": true,
  "user": {
    "username": "testuser",
    "oidcSub": "...",
    "rootDirs": ["/home"],
    "quota": 1073741824
  }
}
```

### 4. Test WebDAV Access

```bash
# Test with session (after web login)
curl -b cookies.txt -X PROPFIND http://localhost:3000/dav/testuser/

# Test with basic auth (fallback)
curl -u testuser:password -X PROPFIND http://localhost:3000/dav/testuser/
```

### 5. Test Logout

```bash
curl -b cookies.txt -c cookies.txt http://localhost:3000/auth/logout
```

Should redirect to Keycloak logout page.

## Troubleshooting

### Common Issues

1. **OIDC Discovery Failed**
   ```
   Error: Failed to initialize OIDC service
   ```
   - Check Keycloak is running
   - Verify `KEYCLOAK_ISSUER_URL` in `.env`
   - Check network connectivity

2. **Invalid Redirect URI**
   ```
   Error: invalid_request_uri
   ```
   - Verify redirect URI in Keycloak client matches `.env`
   - Check for trailing slashes

3. **User Not Authorized**
   ```
   Error: User not authorized
   ```
   - Check user exists in `users_config.json`
   - Verify username/email mapping
   - Check Keycloak user attributes

4. **Session Issues**
   ```
   Error: Authentication required
   ```
   - Check `SESSION_SECRET` is set
   - Verify cookie settings
   - Check session middleware configuration

### Debug Mode

Enable debug logging:
```bash
DEBUG=oidc-client:* npm run dev
```

### Check Logs

Monitor server logs for detailed error messages:
```bash
tail -f logs/server.log
```

## API Endpoints Reference

### Authentication Endpoints

- `GET /auth/login` - Initiate OIDC login
- `GET /auth/callback` - Handle OIDC callback  
- `GET /auth/logout` - Logout
- `GET /auth/status` - Check auth status
- `POST /auth/refresh` - Refresh tokens
- `GET /auth/whois/:username` - Get user info

### Test Commands

```bash
# Check authentication status
curl -b cookies.txt http://localhost:3000/auth/status

# Get user information
curl -b cookies.txt http://localhost:3000/auth/whois/testuser

# Refresh tokens
curl -b cookies.txt -X POST http://localhost:3000/auth/refresh

# Test WebDAV with session
curl -b cookies.txt -X PROPFIND http://localhost:3000/dav/testuser/

# Test WebDAV with basic auth
curl -u testuser:password -X PROPFIND http://localhost:3000/dav/testuser/
```

## Security Checklist

- [ ] HTTPS enabled in production
- [ ] Strong session secret configured
- [ ] Keycloak client secret secured
- [ ] CORS properly configured
- [ ] CSP headers in place
- [ ] Session timeout configured
- [ ] Token refresh working
- [ ] Logout clears all tokens

## Performance Considerations

- [ ] Session store configured (Redis for production)
- [ ] Token caching implemented
- [ ] Connection pooling for Keycloak
- [ ] Monitoring and logging in place
