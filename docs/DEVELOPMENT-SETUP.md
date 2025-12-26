# Development Setup: Multi-Server Session Configuration

This guide explains how to configure session management when running three servers simultaneously in development:

1. **Vite Dev Server** (Client) - typically runs on `http://localhost:5173`
2. **Node.js Backend Server** - runs on the port specified in `.env`
3. **Keycloak Server** - runs on its own port (e.g., `http://localhost:9443`)

## Architecture Overview

```
┌─────────────────┐      API Requests       ┌──────────────────┐
│  Vite Client    │ ───────────────────────> │  Node.js Server  │
│  localhost:5173 │ <─────────────────────── │  localhost:3000  │
└─────────────────┘   (proxied by Vite)      └──────────────────┘
                                                       │
                                                       │ OIDC Flow
                                                       ▼
                                              ┌──────────────────┐
                                              │  Keycloak        │
                                              │  localhost:9443  │
                                              └──────────────────┘
```

## Critical Parameters for Session Management

### 1. Node.js Backend Server Configuration (`.env` file)

```bash
# Server Configuration
SERVER_PORT=3000                          # Backend server port
SERVER_SSL_ENABLED=false                  # Use false for development to avoid cert issues

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Keycloak OIDC Configuration
KEYCLOAK_ISSUER_URL=http://localhost:9443/realms/hironico.net
KEYCLOAK_CLIENT_ID=account-nico-drive-dev
KEYCLOAK_CLIENT_SECRET=your-keycloak-client-secret
KEYCLOAK_REDIRECT_URI=http://localhost:5173/auth/callback  # IMPORTANT: Points to Vite dev server!

# Other required settings
DAV_WEB_CONTEXT=/dav
DAV_USERS_CONFIG=./users_config.json
DAV_DATA_HOME=/data/nicodrive/root/
CLIENT_ROOT_DIR=../client
NODE_ENV=development
```

**Key Session Parameters in `src/index.ts`:**

```typescript
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore,  // Use MemoryStore for development
    cookie: {
        secure: false,              // MUST be false in development without HTTPS
        httpOnly: true,             // Prevents XSS attacks
        sameSite: 'lax',           // Allows cookies across proxied requests
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
```

**Key CORS Parameters in `src/index.ts`:**

```typescript
const corsOptions: CorsOptions = {
    origin: (origin, callback) => { callback(null, true) },  // Allow all origins in dev
    credentials: true,              // CRITICAL: Enables cookie transmission
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE,LOCK,UNLOCK",
    allowedHeaders: 'Content-Type,Authorization'
};
```

### 2. Vite Client Configuration (`vite.config.js`)

```javascript
export default defineConfig({
  server: {
    port: 5173,  // Default Vite port
    proxy: {
      '/auth': {
        target: 'http://localhost:3000',     // Backend server
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',    // Rewrite cookie domain
        cookiePathRewrite: '/'               // Rewrite cookie path
      },
      '/dav': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/'
      },
      '/thumb': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/'
      },
      '/meta': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/'
      },
      '/zip': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/'
      }
    }
  }
})
```

### 3. Keycloak Client Configuration

In Keycloak Admin Console, configure your client with these settings:

**Valid Redirect URIs:**
```
http://localhost:5173/auth/callback
http://localhost:5173/*
http://localhost:3000/auth/callback
http://localhost:3000/*
```

**Valid Post Logout Redirect URIs:**
```
http://localhost:5173/
http://localhost:3000/
```

**Web Origins:**
```
http://localhost:5173
http://localhost:3000
```

**Client Settings:**
- Client Protocol: `openid-connect`
- Access Type: `confidential`
- Standard Flow Enabled: `ON`
- Direct Access Grants Enabled: `OFF`
- Service Accounts Enabled: `ON`
- Authorization Enabled: `OFF`
- Root URL: `http://localhost:5173`
- Base URL: `/`

## Session Cookie Requirements

For sessions to work across the proxied setup, you need:

### 1. Cookie Domain
- **Development**: Set to `localhost` (no subdomain)
- **Production**: Set to your actual domain (e.g., `.yourdomain.com` with leading dot for all subdomains)

### 2. Cookie Path
- Should be `/` to be accessible across all routes

### 3. Cookie Secure Flag
- **Development**: `false` (since you're using HTTP)
- **Production**: `true` (requires HTTPS)

### 4. Cookie SameSite
- **Development**: `'lax'` or `'none'` (if using `'none'`, requires `secure: true`)
- **Production**: `'lax'` is recommended

### 5. Credentials
- Must be `true` in both CORS configuration and fetch requests
- Vite proxy should include `cookieDomainRewrite` and `cookiePathRewrite`

## Common Issues and Solutions

### Issue 1: Session Cookie Not Being Set

**Symptoms**: Authentication succeeds but `/auth/status` shows user as unauthenticated

**Solution**:
- Verify `credentials: true` in CORS configuration
- Check cookie `secure` flag matches your protocol (false for HTTP)
- Ensure `KEYCLOAK_REDIRECT_URI` points to Vite dev server (`http://localhost:5173/auth/callback`)

### Issue 2: Cookie Not Sent with API Requests

**Symptoms**: First request works, subsequent requests fail authentication

**Solution**:
- Add `cookieDomainRewrite: 'localhost'` to all Vite proxy configurations
- Ensure client-side fetch includes `credentials: 'include'`
- Verify cookie domain is set correctly (should be `localhost` in dev)

### Issue 3: CORS Errors

**Symptoms**: Browser console shows CORS policy errors

**Solution**:
- Backend CORS origin should allow the Vite dev server: `origin: (origin, callback) => { callback(null, true) }`
- Ensure `credentials: true` in CORS config
- Verify `Access-Control-Allow-Credentials: true` header in responses

### Issue 4: Keycloak Redirect Issues

**Symptoms**: After Keycloak login, redirect fails or goes to wrong URL

**Solution**:
- Set `KEYCLOAK_REDIRECT_URI=http://localhost:5173/auth/callback` in `.env`
- Configure Keycloak client with `http://localhost:5173/*` as valid redirect URI
- Ensure Keycloak's Web Origins includes `http://localhost:5173`

## Running the Development Environment

### Step 1: Start Keycloak
```bash
cd tools/podman
./podman_run_dev_keycloak.sh
```
Keycloak will be available at `http://localhost:9443`

### Step 2: Configure `.env` File
```bash
cp dotenv-sample .env
# Edit .env with the parameters above
```

### Step 3: Start Node.js Backend Server with Debugging

In VS Code:
1. Open the Debug panel (⇧⌘D)
2. Select "Launch Program" or create a debug configuration
3. Set breakpoints as needed
4. Press F5 to start debugging

Or use command line:
```bash
npm run dev
```

### Step 4: Start Vite Dev Server
```bash
cd ../nico.drive.client
npm run dev
```

### Step 5: Access the Application
Open browser to `http://localhost:5173`

## VS Code Debug Configuration

Create `.vscode/launch.json` in the server project:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Nico.Drive Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Security Considerations

### Development vs Production

| Parameter | Development | Production |
|-----------|-------------|------------|
| `cookie.secure` | `false` | `true` |
| `SERVER_SSL_ENABLED` | `false` | `true` |
| `CORS origin` | Allow all | Specific domains only |
| `SESSION_SECRET` | Any value | Strong random value |
| `cookie.sameSite` | `'lax'` | `'lax'` or `'strict'` |
| Redirect URIs | localhost URLs | Production URLs |

### Production Checklist

When moving to production:

1. ✅ Enable HTTPS (`SERVER_SSL_ENABLED=true`)
2. ✅ Set `cookie.secure` to `true`
3. ✅ Use strong `SESSION_SECRET`
4. ✅ Restrict CORS origins to your domain
5. ✅ Use Redis for session store (not MemoryStore)
6. ✅ Update all Keycloak URIs to production URLs
7. ✅ Set proper cookie domain for your domain
8. ✅ Configure proper CSP headers

## Debugging Session Issues

### Check Session Cookie in Browser

1. Open Developer Tools (F12)
2. Go to Application/Storage tab
3. Check Cookies for `localhost`
4. Look for `connect.sid` (or your session cookie name)
5. Verify:
   - Domain: `localhost`
   - Path: `/`
   - HttpOnly: `true`
   - Secure: `false` (in dev)
   - SameSite: `Lax`

### Server-Side Debugging

Add logging to `src/index.ts`:

```typescript
app.use((req, res, next) => {
    console.log('Session:', req.session);
    console.log('Cookies:', req.headers.cookie);
    console.log('User:', req.session?.user);
    next();
});
```

### Network Tab Analysis

1. Open Network tab in DevTools
2. Trigger authentication flow
3. Check `/auth/callback` response headers:
   - Should include `Set-Cookie` header
   - Cookie should have proper flags
4. Check subsequent API calls:
   - Should include `Cookie` header
   - Should contain session ID

## References

- [Express Session Documentation](https://www.npmjs.com/package/express-session)
- [CORS Documentation](https://www.npmjs.com/package/cors)
- [Vite Proxy Configuration](https://vitejs.dev/config/server-options.html#server-proxy)
- [Keycloak OIDC Documentation](https://www.keycloak.org/docs/latest/securing_apps/)
- [MDN: HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
