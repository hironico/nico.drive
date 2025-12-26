# Configuring Keycloak to Send User Roles

This guide explains how to configure Keycloak so that user roles are included in the OIDC tokens and userinfo endpoint.

## Problem
The `oidcUser.roles` property is undefined because Keycloak is not configured to send roles in the token or userinfo response.

## Solution: Configure Keycloak Client Mappers

### Method 1: Using Built-in Client Scope (Recommended)

1. **Add the roles client scope to your client:**
   - In Keycloak Admin Console, go to **Clients**
   - Select your client (e.g., `nico-drive-client`)
   - Go to the **Client Scopes** tab
   - Under **Assigned Default Client Scopes**, ensure `roles` is listed
   - If not, click **Add client scope**, select `roles`, and add it as **Default**

2. **Verify the roles mapper exists:**
   - Go to **Client Scopes** in the left menu
   - Click on `roles`
   - Go to the **Mappers** tab
   - You should see a mapper called `realm roles` or similar
   - If not, create it (see Method 2 below)

### Method 2: Create Custom Client Mapper

If the built-in roles scope doesn't work, create a custom mapper:

1. **Navigate to your client:**
   - Go to **Clients** → Select your client

2. **Add a new mapper:**
   - Go to the **Mappers** tab
   - Click **Add mapper** → **By configuration**
   - Select **User Realm Role**

3. **Configure the mapper:**
   ```
   Name: realm-roles
   Mapper Type: User Realm Role
   Multivalued: ON
   Token Claim Name: realm_access.roles
   Claim JSON Type: String
   Add to ID token: ON
   Add to access token: ON
   Add to userinfo: ON
   ```

4. **Save the mapper**

### Method 3: Add Client Roles Mapper (if using client-specific roles)

If you're using client-specific roles:

1. **Create a client roles mapper:**
   - Go to your client's **Mappers** tab
   - Click **Add mapper** → **By configuration**
   - Select **User Client Role**

2. **Configure:**
   ```
   Name: client-roles
   Mapper Type: User Client Role
   Client ID: nico-drive-client (your client ID)
   Multivalued: ON
   Token Claim Name: resource_access.${client_id}.roles
   Claim JSON Type: String
   Add to ID token: ON
   Add to access token: ON
   Add to userinfo: ON
   ```

## Assign Roles to Users

1. **Create the admin role:**
   - Go to **Realm Roles** (or **Clients** → your client → **Roles** for client roles)
   - Click **Create Role**
   - Name: `nicodrive-admin`
   - Save

2. **Assign role to user:**
   - Go to **Users**
   - Select the user
   - Go to **Role Mapping** tab
   - Click **Assign role**
   - Select `nicodrive-admin`
   - Click **Assign**

## Verify Configuration

### Test with Keycloak Token Inspector

1. **Get tokens:**
   - Use the Keycloak token endpoint to get tokens
   - Or use a tool like Postman

2. **Decode the ID token:**
   - Use jwt.io to decode the token
   - Look for the `realm_access` or `resource_access` claims

3. **Expected token structure:**
   ```json
   {
     "realm_access": {
       "roles": [
         "nicodrive-admin",
         "default-roles-myrealm"
       ]
     }
   }
   ```
   
   Or for client roles:
   ```json
   {
     "resource_access": {
       "nico-drive-client": {
         "roles": [
           "nicodrive-admin"
         ]
       }
     }
   }
   ```

### Test UserInfo Endpoint

Make a request to the userinfo endpoint:
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-keycloak-server/realms/your-realm/protocol/openid-connect/userinfo
```

Expected response should include roles:
```json
{
  "sub": "user-id",
  "preferred_username": "username",
  "email": "user@example.com",
  "realm_access": {
    "roles": [
      "nicodrive-admin"
    ]
  }
}
```

## Code Configuration

The nico.drive application already handles both realm and client roles:

```typescript
// In src/lib/oidc-auth.ts
private mapUserInfo(userinfo: Record<string, unknown>): OIDCUser {
    const typedUserInfo = userinfo as KeycloakUserInfo;
    
    const user: OIDCUser = {
        username: typedUserInfo.preferred_username || /* ... */,
        // ...
    };

    // Extract roles from Keycloak claims
    if (typedUserInfo.realm_access?.roles) {
        user.roles = typedUserInfo.realm_access.roles; // ✓ Realm roles
    } else if (typedUserInfo.resource_access && process.env.KEYCLOAK_CLIENT_ID) {
        const clientAccess = typedUserInfo.resource_access[process.env.KEYCLOAK_CLIENT_ID];
        if (clientAccess?.roles) {
            user.roles = clientAccess.roles; // ✓ Client roles
        }
    }

    return user;
}
```

## Troubleshooting

### Roles still not appearing?

1. **Check the scope parameter:**
   - Ensure your authentication request includes `scope: 'openid profile email'`
   - The code already does this in `oidc-auth.ts`

2. **Clear browser cache and cookies:**
   - Old sessions might not have the new mappers

3. **Re-authenticate:**
   - Log out completely and log back in

4. **Check Keycloak logs:**
   - Look for any mapper errors

5. **Verify client configuration:**
   - Ensure "Full Scope Allowed" is enabled (if needed)
   - Client Protocol: openid-connect
   - Access Type: confidential

6. **Check mapper configuration:**
   - Make sure "Add to userinfo" is enabled
   - Make sure "Add to ID token" is enabled

## Alternative: Use Groups Instead of Roles

If you prefer using groups:

1. Create a group mapper similar to the roles mapper
2. Modify the code to check for groups instead of roles
3. Add users to the `nicodrive-admins` group

## References

- [Keycloak Documentation - Mappers](https://www.keycloak.org/docs/latest/server_admin/#_protocol-mappers)
- [Keycloak Documentation - Client Scopes](https://www.keycloak.org/docs/latest/server_admin/#_client_scopes)
- [OIDC Standard Claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims)
