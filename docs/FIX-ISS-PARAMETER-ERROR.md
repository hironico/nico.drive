# Fixing "iss (issuer) parameter missing" Error

## Problem

Getting `OAUTH_INVALID_RESPONSE` with error description "iss (issuer) parameter missing" during the OAuth callback.

## Root Cause

The openid-client library validates that the ID token contains an `iss` (issuer) claim that matches the configured issuer URL. This error occurs when:

1. **Mismatch between configured issuer and token issuer**
   - Your `.env` has: `KEYCLOAK_ISSUER_URL=https://localhost:9443/realms/hironico.net`
   - But Keycloak token contains a different issuer value

2. **Protocol mismatch (common issue)**
   - Frontend/Backend use `https://localhost:9443`
   - But Keycloak returns `http://localhost:9443` in the token

3. **Missing trailing slash or realm name issues**

## Solution Steps

### Step 1: Check Keycloak's Issuer Configuration

1. Go to Keycloak Admin Console: `https://localhost:9443/admin`
2. Select your realm: **hironico.net**
3. Go to **Realm Settings** → **General** tab
4. Check the **Frontend URL** setting

**Important**: The Frontend URL should match what you're using in `.env`:
```
https://localhost:9443
```

If it's empty or different, update it and save.

### Step 2: Verify Token Issuer

You can decode the ID token to see what issuer Keycloak is returning:

1. Add temporary logging to see the token response
2. Copy the `id_token` value
3. Go to https://jwt.io and paste the token
4. Look at the `iss` claim in the decoded payload

The `iss` value should exactly match: `https://localhost:9443/realms/hironico.net`

### Step 3: Check Your .env Configuration

Your `.env` should have:

```bash
# Use HTTPS if Keycloak is on HTTPS
KEYCLOAK_ISSUER_URL=https://localhost:9443/realms/hironico.net

# NOT http if Keycloak is on https
# WRONG: KEYCLOAK_ISSUER_URL=http://localhost:9443/realms/hironico.net
```

**Critical**: The protocol (http vs https) and port must match exactly!

### Step 4: Verify Keycloak Discovery Endpoint

Test that the discovery endpoint is accessible and returns the correct issuer:

```bash
curl -k https://localhost:9443/realms/hironico.net/.well-known/openid-configuration
```

Look for the `issuer` field in the response. It should be:
```json
{
  "issuer": "https://localhost:9443/realms/hironico.net",
  ...
}
```

If it shows `http://` instead of `https://`, you need to fix Keycloak's configuration.

## Common Fixes

### Fix 1: Update Keycloak Frontend URL

In Keycloak Admin Console:
1. **Realm Settings** → **General**
2. Set **Frontend URL**: `https://localhost:9443`
3. Save and restart Keycloak (or at least restart the realm)

### Fix 2: Force HTTPS in Keycloak

If running Keycloak behind a proxy or in Docker:

1. Check Keycloak startup configuration
2. Ensure these environment variables are set:
   ```bash
   KC_HOSTNAME_STRICT=false
   KC_HOSTNAME_STRICT_HTTPS=false
   KC_PROXY=edge  # or 'reencrypt' depending on setup
   ```

3. Or add to Keycloak standalone.xml:
   ```xml
   <http-listener name="default" socket-binding="http" 
                   proxy-address-forwarding="true" />
   ```

### Fix 3: Use HTTP for Local Development (Simpler)

If Keycloak is actually running on HTTP locally, update your `.env`:

```bash
# Change from HTTPS to HTTP
KEYCLOAK_ISSUER_URL=http://localhost:9443/realms/hironico.net
```

**But this will cause issues with your HTTPS backend!** You'll need to either:
- Run Keycloak on HTTPS (recommended)
- OR run backend on HTTP too (not recommended)

### Fix 4: Check Keycloak Hostname Settings

In newer Keycloak versions (17+), check hostname configuration:

```bash
# In Keycloak config or environment
KC_HOSTNAME=localhost
KC_HOSTNAME_PORT=9443
KC_HOSTNAME_STRICT=false
```

## Temporary Workaround: Add Debug Logging

To see exactly what's happening, add logging to your code:

```typescript
// In src/lib/oidc-auth.ts, after authorizationCodeGrant
console.log('Token Response:', JSON.stringify(tokenResponse, null, 2));
console.log('ID Token Claims:', tokenResponse.claims());
```

This will show you:
- What issuer is in the token
- Whether the token is being received correctly

## Verification

After making changes:

1. **Restart Keycloak** (if you changed Frontend URL)
2. **Restart your backend server**
3. **Clear browser cookies** for localhost
4. **Test the login flow**

Check backend logs for:
```
OIDC client initialized successfully
Authorization code grant with redirect_uri: http://localhost:5173/auth/callback
Token response received successfully
```

If you see the error again, the logs will now show the actual issuer mismatch.

## Expected Configuration

For your setup (Keycloak on HTTPS):

**Keycloak (https://localhost:9443)**
- Realm Settings → Frontend URL: `https://localhost:9443`
- Token issuer: `https://localhost:9443/realms/hironico.net`

**.env File**
```bash
KEYCLOAK_ISSUER_URL=https://localhost:9443/realms/hironico.net
KEYCLOAK_CLIENT_ID=account-nico-drive-dev
KEYCLOAK_CLIENT_SECRET=VccTgPuSY8GkJfB7lXnVwtFh1VBBk7XJ
KEYCLOAK_REDIRECT_URI=http://localhost:5173/auth/callback
```

**Keycloak Client Settings**
- Valid Redirect URIs:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/*`
  - `https://localhost:3443/auth/callback`
  - `https://localhost:3443/*`
- Web Origins:
  - `http://localhost:5173`
  - `https://localhost:3443`

## Still Having Issues?

If the error persists:

1. **Check Keycloak logs** for any errors
2. **Verify Keycloak is actually running on HTTPS** (not HTTP)
3. **Test with curl** to see what issuer Keycloak returns
4. **Compare issuer in token** (via jwt.io) with your KEYCLOAK_ISSUER_URL

The issuer values must match EXACTLY (including protocol, hostname, port, and path).
