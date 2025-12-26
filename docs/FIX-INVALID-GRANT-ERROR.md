# Fixing "invalid_grant" Error in OAuth Callback

## Problem

You're getting an `invalid_grant` error when Keycloak redirects back to `/auth/callback`. This happens due to a redirect URI mismatch.

## Root Causes

There are TWO potential issues that cause `invalid_grant` errors:

### Issue 1: Redirect URI Not in Keycloak's Allowed List
- **Redirect URI in .env**: `http://localhost:5173/auth/callback`
- **Keycloak Client Config**: Only accepts `https://localhost:3443/auth/callback`
- When Keycloak validates the redirect, it fails because `http://localhost:5173/auth/callback` is not in the allowed list

### Issue 2: Redirect URI Mismatch During Token Exchange (CRITICAL!)
Even after adding the redirect URI to Keycloak, you may get "Code not valid" error because:

1. **Authorization request** sends: `redirect_uri=http://localhost:5173/auth/callback`
2. **Browser redirects** to: `http://localhost:5173/auth/callback?code=...`
3. **Vite proxy forwards** to: `https://localhost:3443/auth/callback?code=...`
4. **Backend constructs URL** from request: `https://localhost:3443/auth/callback` (WRONG!)
5. **Token exchange** sends: `redirect_uri=https://localhost:3443/auth/callback`
6. **Keycloak rejects** because redirect URIs don't match (http vs https)!

**The Fix**: Always use the configured `KEYCLOAK_REDIRECT_URI` from `.env` for token exchange, never construct it from the incoming request.

## Solution: Update Keycloak Client Configuration

### Step 1: Access Keycloak Admin Console

1. Go to `https://localhost:9443/admin`
2. Login with admin credentials
3. Select realm: `hironico.net`
4. Navigate to **Clients** → **account-nico-drive-dev**

### Step 2: Update Valid Redirect URIs

In the **Settings** tab, update **Valid Redirect URIs** to include BOTH:

```
https://localhost:3443/auth/callback
https://localhost:3443/*
http://localhost:5173/auth/callback
http://localhost:5173/*
```

### Step 3: Update Web Origins

In the same tab, update **Web Origins** to include BOTH:

```
https://localhost:3443
http://localhost:5173
```

### Step 4: Update Valid Post Logout Redirect URIs

Add these URLs:

```
https://localhost:3443/
http://localhost:5173/
```

### Step 5: Save Changes

Click **Save** at the bottom of the page.

## Your Current Configuration is Correct

Your `.env` file is already correctly configured:
```bash
KEYCLOAK_REDIRECT_URI=http://localhost:5173/auth/callback  # ✅ Correct for Vite
```

Your `vite.config.js` is now correctly pointing to the HTTPS backend:
```javascript
target: 'https://localhost:3443'  // ✅ Correct
```

## Why This Works

1. **User visits**: `http://localhost:5173` (Vite dev server)
2. **Clicks login**: Request proxied to `https://localhost:3443/auth/login`
3. **Backend redirects to Keycloak**: `https://localhost:9443/realms/...` with `redirect_uri=http://localhost:5173/auth/callback`
4. **Keycloak validates**: Checks if `http://localhost:5173/auth/callback` is in allowed redirect URIs ✅
5. **User authenticates**: Logs in on Keycloak
6. **Keycloak redirects back**: To `http://localhost:5173/auth/callback?code=...`
7. **Vite receives request**: Proxies it to `https://localhost:3443/auth/callback`
8. **Backend exchanges code**: For tokens with Keycloak ✅
9. **Session created**: Cookie set and user authenticated ✅

## Alternative: Use HTTPS for Vite (More Complex)

If you want Vite to also run on HTTPS:

### 1. Generate certificates for Vite

```bash
cd ../nico.drive.client
mkdir -p .cert
openssl req -x509 -newkey rsa:4096 -keyout .cert/key.pem -out .cert/cert.pem -days 365 -nodes -subj "/CN=localhost"
```

### 2. Update vite.config.js

```javascript
import fs from 'fs';

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('.cert/key.pem'),
      cert: fs.readFileSync('.cert/cert.pem'),
    },
    port: 5173,
    proxy: {
      // ... same proxy config
    }
  }
})
```

### 3. Update .env

```bash
KEYCLOAK_REDIRECT_URI=https://localhost:5173/auth/callback
```

### 4. Update Keycloak Client

Change redirect URIs to use HTTPS:
```
https://localhost:5173/auth/callback
https://localhost:5173/*
```

**Note**: This is more complex and requires accepting the self-signed certificate in your browser for both ports (3443 and 5173).

## Recommended: Keep Vite on HTTP (Simpler)

For development, it's simpler to:
- ✅ Keep Vite on HTTP (`http://localhost:5173`)
- ✅ Keep backend on HTTPS (`https://localhost:3443`)
- ✅ Update Keycloak to accept BOTH HTTP and HTTPS redirect URIs

This way, you only need to accept one self-signed certificate (for the backend at 3443).

## Verification

After updating Keycloak:

1. **Restart your backend server** (if needed)
2. **Clear browser cookies** for `localhost`
3. **Visit**: `http://localhost:5173`
4. **Click login**
5. **Authenticate** on Keycloak
6. **Should redirect back** successfully without `invalid_grant` error

### Check Browser DevTools

If still having issues:

1. Open DevTools → Network tab
2. Look for the redirect from Keycloak
3. Check the URL - should be `http://localhost:5173/auth/callback?code=...&state=...`
4. Check the response - should NOT contain "invalid_grant"
5. If it does, verify Keycloak client config again

### Check Backend Logs

Look for these in your backend console:
```
Authorization code grant with URL: http://localhost:5173/auth/callback?code=...&state=...
Token response received successfully
User info received successfully: {...}
OIDC authentication successful for user: <username>
```

If you see `invalid_grant`, double-check:
- Keycloak client's Valid Redirect URIs includes `http://localhost:5173/auth/callback`
- The client secret in `.env` matches Keycloak client secret
- Keycloak client is enabled

## Summary

**The Fix**: Add `http://localhost:5173/auth/callback` and `http://localhost:5173/*` to your Keycloak client's **Valid Redirect URIs** in the Keycloak Admin Console.

This allows the OAuth flow to work with:
- Vite on HTTP (port 5173)
- Backend on HTTPS (port 3443)  
- Keycloak on HTTPS (port 9443)
