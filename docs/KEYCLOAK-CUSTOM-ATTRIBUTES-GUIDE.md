# Keycloak Custom User Attributes Guide

This guide explains how to extract custom user profile attributes (like 'quota') from Keycloak in your nico.drive application.

## Overview

The implementation now supports extracting custom user attributes from Keycloak user profiles. The system automatically maps these attributes to your application's user object, making them available throughout the application.

## Keycloak Configuration

### 1. Enable User Profile Attributes in Keycloak

#### Step 1: Access Keycloak Admin Console
1. Navigate to your Keycloak Admin Console (e.g., `http://localhost:8080/admin`)
2. Select your realm
3. Go to **Realm Settings** → **User Profile**

#### Step 2: Add Custom Attribute
1. Click **"Create attribute"**
2. Set the following:
   - **Name**: `quota`
   - **Display name**: `User Quota`
   - **Group**: `user-metadata` (or create a new group)
   - **Required**: Set as needed
   - **Permissions**: Configure who can view/edit

#### Step 3: Configure Attribute for Token Claims
1. Go to **Client Scopes** → **profile** (or create a custom scope)
2. Click **"Add mapper"** → **"By configuration"** → **"User Attribute"**
3. Configure the mapper:
   - **Name**: `quota-mapper`
   - **User Attribute**: `quota`
   - **Token Claim Name**: `quota`
   - **Claim JSON Type**: `long` (for numbers) or `String`
   - **Add to ID token**: Yes
   - **Add to access token**: Yes
   - **Add to userinfo**: Yes

### 2. Set User Attributes

#### Via Admin Console:
1. Go to **Users** → Select a user → **Attributes** tab
2. Add attribute:
   - **Key**: `quota`
   - **Value**: `5368709120` (example: 5GB in bytes)

#### Via User Registration:
Configure the user profile to include the quota field during registration.

## Code Implementation

### 1. Interface Definitions

The `OIDCUser` interface includes the quota field:

```typescript
export interface OIDCUser {
    username: string;
    email?: string;
    name?: string;
    roles?: string[];
    quota?: number;  // Custom quota attribute
}
```

### 2. Keycloak UserInfo Interface

The `KeycloakUserInfo` interface supports custom attributes:

```typescript
interface KeycloakUserInfo {
    preferred_username?: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    sub?: string;
    quota?: number | string; // Custom attribute from Keycloak
    realm_access?: {
        roles?: string[];
    };
    resource_access?: {
        [clientId: string]: {
            roles?: string[];
        };
    };
    // Support for any additional custom attributes
    [key: string]: unknown;
}
```

### 3. Attribute Extraction Logic

The `mapUserInfo` method extracts the quota attribute:

```typescript
// Extract quota from Keycloak user profile attributes
if (typedUserInfo.quota !== undefined) {
    // Handle quota as either number or string
    if (typeof typedUserInfo.quota === 'number') {
        user.quota = typedUserInfo.quota;
    } else if (typeof typedUserInfo.quota === 'string') {
        const parsedQuota = parseInt(typedUserInfo.quota, 10);
        if (!isNaN(parsedQuota)) {
            user.quota = parsedQuota;
        }
    }
}
```

## Adding More Custom Attributes

### 1. Extend the Interfaces

Add new attributes to both interfaces:

```typescript
export interface OIDCUser {
    username: string;
    email?: string;
    name?: string;
    roles?: string[];
    quota?: number;
    department?: string;     // New custom attribute
    employeeId?: string;     // New custom attribute
    permissions?: string[];  // New custom attribute
}

interface KeycloakUserInfo {
    // ... existing fields ...
    quota?: number | string;
    department?: string;     // New custom attribute
    employeeId?: string;     // New custom attribute
    permissions?: string[];  // New custom attribute
    [key: string]: unknown;
}
```

### 2. Update the Mapping Logic

Add extraction logic in `mapUserInfo`:

```typescript
// Extract custom attributes
if (typedUserInfo.quota !== undefined) {
    // Handle quota as number or string
    if (typeof typedUserInfo.quota === 'number') {
        user.quota = typedUserInfo.quota;
    } else if (typeof typedUserInfo.quota === 'string') {
        const parsedQuota = parseInt(typedUserInfo.quota, 10);
        if (!isNaN(parsedQuota)) {
            user.quota = parsedQuota;
        }
    }
}

// Extract department
if (typedUserInfo.department) {
    user.department = String(typedUserInfo.department);
}

// Extract employee ID
if (typedUserInfo.employeeId) {
    user.employeeId = String(typedUserInfo.employeeId);
}

// Extract permissions (assuming it's an array or comma-separated string)
if (typedUserInfo.permissions) {
    if (Array.isArray(typedUserInfo.permissions)) {
        user.permissions = typedUserInfo.permissions.map(p => String(p));
    } else if (typeof typedUserInfo.permissions === 'string') {
        user.permissions = typedUserInfo.permissions.split(',').map(p => p.trim());
    }
}
```

### 3. Update Session Interface

Update the session interface in `auth.ts`:

```typescript
declare module 'express-session' {
    interface SessionData {
        user?: {
            username: string;
            email?: string;
            name?: string;
            roles?: string[];
            quota?: number;
            department?: string;     // New custom attribute
            employeeId?: string;     // New custom attribute
            permissions?: string[];  // New custom attribute
        };
        oidcState?: string;
        oidcCodeVerifier?: string;
        idToken?: string;
    }
}
```

## Usage Examples

### 1. Accessing Quota in Routes

```typescript
app.get("/user/quota", (req, res) => {
    if (req.session?.user?.quota) {
        res.json({
            username: req.session.user.username,
            quota: req.session.user.quota,
            quotaFormatted: formatBytes(req.session.user.quota)
        });
    } else {
        res.status(404).json({ error: 'Quota not available' });
    }
});
```

### 2. Using Quota in WebDAV Authentication

You can access the quota in the WebDAV authentication handler:

```typescript
// In oidc-webdav-auth.ts
if (req.session && req.session.user) {
    const sessionUser = req.session.user;
    
    // Use the quota from Keycloak if available
    if (sessionUser.quota) {
        console.log(`User ${sessionUser.username} has quota: ${sessionUser.quota} bytes`);
        // You could set this in the quota manager here
    }
    
    // ... rest of authentication logic
}
```

### 3. Client-Side Usage

The quota is available in the `/auth/status` endpoint response:

```javascript
fetch('/auth/status')
    .then(response => response.json())
    .then(data => {
        if (data.authenticated && data.user.quota) {
            console.log(`User quota: ${data.user.quota} bytes`);
            // Update UI with quota information
        }
    });
```

## Debugging Custom Attributes

### 1. Enable Debug Logging

The user info is logged during authentication:

```
User info received successfully: {
    "preferred_username": "john.doe",
    "email": "john.doe@example.com",
    "quota": "5368709120",
    "department": "Engineering",
    ...
}
```

### 2. Check Keycloak Token

You can inspect the JWT token to verify custom claims are included:
1. Use browser developer tools
2. Check the Network tab during login
3. Decode the JWT token to verify custom claims

### 3. Test with curl

```bash
# Get access token
TOKEN=$(curl -X POST "http://localhost:8080/realms/your-realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=your-client&username=testuser&password=testpass" \
  | jq -r '.access_token')

# Get user info
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/realms/your-realm/protocol/openid-connect/userinfo"
```

## Best Practices

### 1. Data Types
- Use appropriate data types (number for quota, string for department)
- Handle both string and number formats for numeric values
- Validate data before using it

### 2. Security
- Only include necessary attributes in tokens
- Use appropriate scopes to control attribute access
- Validate custom attributes on the server side

### 3. Performance
- Limit the number of custom attributes
- Consider caching frequently accessed attributes
- Use efficient data structures for complex attributes

### 4. Maintenance
- Document all custom attributes and their purposes
- Use consistent naming conventions
- Version your attribute schemas

## Troubleshooting

### Common Issues:

1. **Attribute not appearing in userinfo**
   - Check mapper configuration in Keycloak
   - Verify the attribute is set for the user
   - Ensure the scope includes the mapper

2. **Type conversion errors**
   - Check the data type in Keycloak
   - Verify parsing logic in `mapUserInfo`
   - Add proper error handling

3. **Session not updated**
   - Clear browser cookies/session
   - Restart the application
   - Check session configuration

This implementation provides a flexible foundation for extracting any custom user attributes from Keycloak and making them available throughout your nico.drive application.
