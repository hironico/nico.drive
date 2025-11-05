# Keycloak OpenID Connect Integration for Nico.Drive

This document describes the Keycloak OpenID Connect (OIDC) authentication implementation for the Nico.Drive application.

## Overview

The application has been updated to use Keycloak for authentication instead of the previous basic authentication system. Users are now redirected to Keycloak's login page for authentication, and the application maintains session-based authentication for web clients while supporting basic auth fallback for WebDAV clients.

## Architecture

### Components

1. **OIDC Authentication Service** (`src/lib/oidc-auth.ts`)
   - Handles OIDC discovery and client configuration
   - Manages authorization URL generation
   - Processes authentication callbacks
   - Handles token refresh and validation

2. **User Mapper** (`src/lib/user-mapper.ts`)
   - Maps OIDC users to internal user configuration
   - Extracts roles from OIDC claims
   - Handles user authorization based on existing `users_config.json`

3. **Authentication Routes** (`src/routes/auth.ts`)
   - `/auth/login` - Initiates OIDC login flow
   - `/auth/callback` - Handles OIDC callback
   - `/auth/logout` - Handles logout with Keycloak
   - `/auth/status` - Checks authentication status
   - `/auth/whois/:username` - Gets user information

4. **WebDAV Authentication** (`src/middleware/oidc-webdav-auth.ts`)
   - Custom WebDAV authentication handler
   - Supports session-based auth for web clients
   - Falls back to basic auth for WebDAV clients

5. **Auth Guard Middleware** (`src/middleware/auth-guard.ts`)
   - Protects routes requiring authentication
   - Redirects unauthenticated users to login page
   - Supports role-based access control

## Configuration

### Environment Variables

Copy `dotenv-keycloak-sample` to `.env` and configure:

```bash
# Keycloak OIDC Configuration
KEYCLOAK_ISSUER_URL=https://localhost:9443/realms/hironico.net
KEYCLOAK_CLIENT_ID=account-nico-drive-dev
KEYCLOAK_CLIENT_SECRET=your-keycloak-client-secret
KEYCLOAK_REDIRECT_URI=http://localhost:3000/auth/callback

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
```

### Keycloak Client Configuration

In your Keycloak realm (`hironico.net`), configure the client (`account-nico-drive-dev`):

1. **Client Type**: OpenID Connect
2. **Access Type**: Confidential
3. **Valid Redirect URIs**: `http://localhost:3000/auth/callback`
4. **Web Origins**: `http://localhost:3000`
5. **Standard Flow Enabled**: ON
6. **Direct Access Grants Enabled**: OFF (recommended)

### User Mapping

Users are mapped from Keycloak to the existing `users_config.json` structure:

- Keycloak `preferred_username` or `email` must match a username in `users_config.json`
- Existing quota and directory configurations are preserved
- Roles can be extracted from Keycloak claims (`realm_access.roles` or `resource_access`)

## Authentication Flow

### Web Application Flow

1. User visits the application
2. Auth guard middleware checks for valid session
3. If not authenticated, user is redirected to `/login.html`
4. Login page redirects to `/auth/login`
5. Server generates PKCE parameters and redirects to Keycloak
6. User authenticates with Keycloak
7. Keycloak redirects back to `/auth/callback`
8. Server validates the callback and creates session
9. User is redirected to the main application

### WebDAV Client Flow

1. WebDAV client makes request with basic auth credentials
2. Custom WebDAV authentication handler validates credentials
3. If session exists, user is authenticated via OIDC
4. If no session, falls back to basic auth validation
5. User gains access to WebDAV resources

## Security Features

### PKCE (Proof Key for Code Exchange)

- Generates cryptographically random code verifier
- Uses SHA256 code challenge method
- Protects against authorization code interception

### Session Security

- HttpOnly cookies prevent XSS attacks
- Secure flag for HTTPS environments
- 24-hour session timeout
- CSRF protection via session state validation

### Token Management

- Access tokens stored in server-side sessions
- Automatic token refresh when possible
- Secure token validation with Keycloak

## API Endpoints

### Authentication Endpoints

- `GET /auth/login` - Initiate OIDC login
- `GET /auth/callback` - Handle OIDC callback
- `GET /auth/logout` - Logout and redirect to Keycloak
- `GET /auth/status` - Check authentication status
- `POST /auth/refresh` - Refresh access token
- `GET /auth/whois/:username` - Get user profile

### Protected Resources

- All main application routes require authentication
- WebDAV endpoints support both session and basic auth
- API endpoints return JSON error responses for unauthenticated requests

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp dotenv-keycloak-sample .env
   # Edit .env with your Keycloak configuration
   ```

3. **Start Keycloak**
   ```bash
   ./podman_run_keycloak.sh
   ```

4. **Configure Keycloak Client**
   - Access Keycloak admin console
   - Create/configure the client as described above

5. **Start Application**
   ```bash
   npm run dev
   ```

## Production Considerations

### Session Store

For production, consider using Redis for session storage:

```bash
npm install connect-redis redis
```

Update session configuration in `src/index.ts`:

```typescript
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL
});

app.use(session({
    store: new RedisStore({ client: redisClient }),
    // ... other options
}));
```

### SSL/TLS

- Enable HTTPS in production
- Configure proper SSL certificates
- Update Keycloak redirect URIs for HTTPS

### Security Headers

- Content Security Policy is configured
- CORS is properly configured for your domain
- Consider additional security headers

## Troubleshooting

### Common Issues

1. **OIDC Discovery Failed**
   - Check Keycloak server is running
   - Verify issuer URL is correct
   - Check network connectivity

2. **Invalid Redirect URI**
   - Ensure redirect URI matches Keycloak client configuration
   - Check for trailing slashes or protocol mismatches

3. **User Not Authorized**
   - Verify user exists in `users_config.json`
   - Check username/email mapping
   - Ensure user has proper directory configurations

4. **Session Issues**
   - Check session secret is configured
   - Verify cookie settings for your environment
   - Consider session store configuration

### Debugging

Enable debug logging by setting environment variables:

```bash
DEBUG=oidc-client:*
NODE_ENV=development
```

Check server logs for detailed error messages and authentication flow information.

## Migration from Basic Auth

The implementation maintains backward compatibility:

1. Existing `users_config.json` structure is preserved
2. WebDAV clients can still use basic authentication
3. User directories and permissions remain unchanged
4. Quota management continues to work as before

To migrate:

1. Configure Keycloak and update environment variables
2. Ensure users exist in both Keycloak and `users_config.json`
3. Test authentication flow with web and WebDAV clients
4. Update client applications to use new login flow
