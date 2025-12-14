# Session Parameters Quick Reference

## Quick Setup for Development (3 Servers)

When running:
- **Vite Dev Server**: `http://localhost:5173` (client)
- **Node.js Server**: `http://localhost:3000` (backend) 
- **Keycloak**: `http://localhost:9443` (authentication)

### Essential Parameters Summary

#### 1. Backend Server (.env file)

```bash
# Server Configuration
SERVER_PORT=3000
SERVER_SSL_ENABLED=false              # ⚠️ Must be false for HTTP

# Session Secret
SESSION_SECRET=your-secret-key

# Keycloak Configuration  
KEYCLOAK_ISSUER_URL=http://localhost:9443/realms/hironico.net
KEYCLOAK_CLIENT_ID=account-nico-drive-dev
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_REDIRECT_URI=http://localhost:5173/auth/callback  # ⚠️ Points to Vite!
```

#### 2. Backend Code (src/index.ts)

```typescript
// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,           // ⚠️ Must be false for HTTP
        httpOnly: true,          // ✅ Security: prevent XSS
        sameSite: 'lax',        // ✅ Required for cross-origin
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// CORS Configuration
const corsOptions = {
    origin: (origin, callback) => callback(null, true),  // Allow all in dev
    credentials: true,           // ⚠️ CRITICAL: enables cookies
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE,LOCK,UNLOCK",
    allowedHeaders: 'Content-Type,Authorization'
};
```

#### 3. Vite Configuration (vite.config.js)

```javascript
server: {
  proxy: {
    '/auth': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: 'localhost',  // ⚠️ CRITICAL for sessions
      cookiePathRewrite: '/'             // ⚠️ CRITICAL for sessions
    },
    '/dav': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: 'localhost',
      cookiePathRewrite: '/'
    }
    // ... repeat for /thumb, /meta, /zip
  }
}
```

#### 4. Keycloak Client Settings

**Admin Console → Clients → account-nico-drive-dev:**

- **Valid Redirect URIs:**
  ```
  http://localhost:5173/auth/callback
  http://localhost:5173/*
  http://localhost:3000/auth/callback
  http://localhost:3000/*
  ```

- **Valid Post Logout Redirect URIs:**
  ```
  http://localhost:5173/
  http://localhost:3000/
  ```

- **Web Origins:**
  ```
  http://localhost:5173
  http://localhost:3000
  ```

- **Root URL:** `http://localhost:5173`

## The 5 Critical Parameters

### 🔴 1. Cookie Domain (Vite Proxy)
**Problem:** Session cookie set by backend has wrong domain  
**Solution:** `cookieDomainRewrite: 'localhost'` in vite.config.js

### 🔴 2. Cookie Path (Vite Proxy)  
**Problem:** Cookie not sent with all API requests  
**Solution:** `cookiePathRewrite: '/'` in vite.config.js

### 🔴 3. Cookie Secure Flag (Backend)
**Problem:** Cookie not set when using HTTP in development  
**Solution:** `secure: false` in session cookie config (dev only!)

### 🔴 4. Cookie SameSite (Backend)
**Problem:** Cookie blocked on cross-origin requests  
**Solution:** `sameSite: 'lax'` in session cookie config

### 🔴 5. CORS Credentials (Backend)
**Problem:** Browser blocks cookie transmission  
**Solution:** `credentials: true` in CORS options

## Common Session Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Cookie not set | Login works but status shows unauthenticated | Check `secure: false` and `KEYCLOAK_REDIRECT_URI` |
| Cookie not sent | First request works, others fail | Add `cookieDomainRewrite` and `cookiePathRewrite` to Vite proxy |
| CORS errors | Console shows CORS policy errors | Verify `credentials: true` in CORS config |
| Wrong redirect | Keycloak redirects to wrong URL | Set `KEYCLOAK_REDIRECT_URI=http://localhost:5173/auth/callback` |

## Verification Checklist

### ✅ Session Cookie Check (Browser DevTools)

1. Open DevTools → Application → Cookies → localhost
2. Find `connect.sid` cookie
3. Verify properties:
   - Domain: `localhost`
   - Path: `/`
   - HttpOnly: ✅
   - Secure: ❌ (in dev)
   - SameSite: `Lax`

### ✅ Network Check

1. DevTools → Network tab
2. Look at `/auth/callback` response
3. Should have `Set-Cookie` header with correct flags
4. Subsequent API calls should include `Cookie` header

### ✅ Backend Logs

Enable debug logging in src/index.ts:
```typescript
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('User:', req.session?.user);
    console.log('Cookie header:', req.headers.cookie);
    next();
});
```

## Starting the Development Environment

```bash
# Terminal 1: Start Keycloak
cd tools/podman
./podman_run_dev_keycloak.sh

# Terminal 2: Start Backend (with debugging in VS Code)
# Or: npm run dev

# Terminal 3: Start Vite Dev Server  
cd ../nico.drive.client
npm run dev

# Browser: Open http://localhost:5173
```

## Production vs Development

| Setting | Development | Production |
|---------|-------------|------------|
| `SERVER_SSL_ENABLED` | `false` | `true` |
| `cookie.secure` | `false` | `true` |
| `KEYCLOAK_REDIRECT_URI` | `http://localhost:5173/...` | `https://yourdomain.com/...` |
| `CORS origin` | Allow all | Specific domains |
| Session store | MemoryStore | Redis |

## Key Files Modified

- ✅ `src/index.ts` - Added `sameSite: 'lax'` to session cookie
- ✅ `../nico.drive.client/vite.config.js` - Added `cookieDomainRewrite` and `cookiePathRewrite`
- ✅ `dotenv-sample` - Updated with development comments
- ✅ `docs/DEVELOPMENT-SETUP.md` - Complete guide created

## Need Help?

See the full documentation:
- `docs/DEVELOPMENT-SETUP.md` - Complete setup guide with troubleshooting
- `docs/README-KEYCLOAK-OIDC.md` - Keycloak OIDC integration details
- `docs/TROUBLESHOOTING-OIDC.md` - Common OIDC issues
