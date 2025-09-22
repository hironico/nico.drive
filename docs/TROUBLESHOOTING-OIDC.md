# OIDC Authentication Troubleshooting Guide

## Common Issues with OIDC Authentication

### Issue 1: "iss" (issuer) parameter missing

#### Problem Description
When calling `client.authorizationCodeGrant`, you may encounter an error:
```
OAUTH_INVALID_RESPONSE with message [cause]: OperationProcessingError: response parameter "iss" (issuer) missing
```

### Issue 2: JWT Timestamp Check Failed

#### Problem Description
After fixing the "iss" parameter issue, you may encounter:
```
OAUTH_JWT_TIMESTAMP_CHECK_FAILED: unexpected JWT "exp" (expiration time) claim value, expiration is past current timestamp
```

This occurs when there's a clock skew between your application server and Keycloak server, or when there's a delay in processing the token.

#### Solution
Add clock tolerance to the authorization code grant:

```typescript
const tokenResponse = await client.authorizationCodeGrant(
    this.config,
    currentUrl,
    {
        expectedState: state,
        pkceCodeVerifier: codeVerifier,
    },
    {
        clockTolerance: '60s', // Allow 60 seconds clock skew
    }
);
```

**Key points:**
- Clock tolerance should be a string (e.g., '60s', '2m')
- This allows for time differences between servers
- Typical values: '30s' to '120s' depending on your environment

### Root Causes and Solutions

#### 1. **Keycloak Configuration Issues**

**Check your Keycloak realm configuration:**
- Ensure the realm is properly configured and running
- Verify the issuer URL is correct in your `.env` file
- The issuer URL should be: `http://localhost:8080/realms/your-realm-name`

**Verify client configuration in Keycloak:**
```json
{
  "clientId": "your-client-id",
  "enabled": true,
  "clientAuthenticatorType": "client-secret",
  "redirectUris": ["http://localhost:3000/auth/callback"],
  "webOrigins": ["http://localhost:3000"],
  "protocol": "openid-connect"
}
```

#### 2. **Environment Configuration**

**Check your `.env` file:**
```bash
# Make sure these are correctly set
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/your-realm
KEYCLOAK_CLIENT_ID=your-client-id
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_REDIRECT_URI=http://localhost:3000/auth/callback
```

**Common mistakes:**
- Missing `/realms/` in the issuer URL
- Wrong port number
- Incorrect realm name
- Missing protocol (http/https)

#### 3. **Network and Connectivity Issues**

**Test Keycloak connectivity:**
```bash
# Test if Keycloak is accessible
curl http://localhost:8080/realms/your-realm/.well-known/openid_configuration

# Should return JSON with issuer, authorization_endpoint, token_endpoint, etc.
```

**Check if the well-known endpoint returns proper issuer:**
The response should include:
```json
{
  "issuer": "http://localhost:8080/realms/your-realm",
  "authorization_endpoint": "http://localhost:8080/realms/your-realm/protocol/openid-connect/auth",
  "token_endpoint": "http://localhost:8080/realms/your-realm/protocol/openid-connect/token",
  ...
}
```

#### 4. **Code-Level Solutions**

**The fix implemented in the code:**
1. **Better error handling** - Added more detailed logging
2. **Proper URL construction** - Using the full callback URL from the request
3. **Robust callback handling** - Supporting both constructed and actual callback URLs

**Key changes made:**
```typescript
// In handleCallback method
const fullCallbackUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

const oidcUser = await oidcAuthService.handleCallback(
    code as string,
    state as string,
    codeVerifier,
    fullCallbackUrl  // Pass the actual callback URL
);
```

#### 5. **Debugging Steps**

**Enable debug logging:**
```bash
# Add to your .env or set as environment variable
DEBUG=oidc:*
```

**Check the logs for:**
1. OIDC client initialization success
2. Authorization URL generation
3. Callback URL construction
4. Token exchange details

**Manual testing:**
```bash
# Test the authorization flow manually
# 1. Get the auth URL from /auth/login
# 2. Complete the flow in browser
# 3. Check the callback URL parameters
# 4. Verify the token endpoint response
```

#### 6. **Keycloak-Specific Solutions**

**Ensure proper Keycloak setup:**
```bash
# Start Keycloak with proper configuration
docker run -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev
```

**Create a proper client in Keycloak:**
1. Go to Admin Console → Clients → Create
2. Set Client ID to match your `KEYCLOAK_CLIENT_ID`
3. Set Client Protocol to `openid-connect`
4. Set Access Type to `confidential`
5. Set Valid Redirect URIs to your callback URL
6. Save and get the client secret

#### 7. **Alternative Approaches**

**If the issue persists, try:**

1. **Use different openid-client version:**
```bash
npm install openid-client@^5.6.5
```

2. **Manual token exchange:**
```typescript
// Alternative implementation using direct HTTP calls
const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
    }),
});
```

### Testing the Fix

**Test the complete flow:**
1. Start your application: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You should be redirected to Keycloak login
4. After login, check the console logs for successful token exchange
5. Verify you're redirected back to the application

**Expected log output:**
```
Initializing OIDC client...
OIDC client initialized successfully
Authorization code grant with URL: http://localhost:3000/auth/callback?code=...&state=...
Token response received successfully
OIDC authentication successful for user: username
```

### Prevention

**To avoid this issue in the future:**
1. Always test Keycloak connectivity before starting the application
2. Use proper environment variable validation
3. Implement health checks for external dependencies
4. Add comprehensive error handling and logging
5. Test with different Keycloak versions and configurations

### Getting Help

If you continue to experience issues:
1. Check Keycloak server logs
2. Enable debug logging in the application
3. Verify network connectivity
4. Test with a minimal OIDC client setup
5. Check Keycloak documentation for your specific version
