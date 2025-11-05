# User Management Functions Guide

This guide explains how to use the new user management functions added to the `src/lib/auth.ts` file for managing users in the `users_config.json` file.

## Overview

The following functions have been added to provide programmatic management of users in the nico.drive application:

- `addUser()` - Add a new user
- `removeUser()` - Remove an existing user
- `updateUser()` - Update an existing user
- `getAllUsers()` - Get all users
- `getUser()` - Get a specific user
- `userExists()` - Check if a user exists

## Function Reference

### 1. addUser(userData: NewUserData): Promise<boolean>

Adds a new user to the users_config.json file.

#### Parameters:
```typescript
interface NewUserData {
    username: string;
    password: string;
    quota?: number;  // Optional, defaults to 1GB (1073741824 bytes)
    rootDirectories: IRootDirectory[];
}

interface IRootDirectory {
    physicalPath: string;
    name: string;
    roles: Array<string>;
}
```

#### Example Usage:
```typescript
import { addUser } from './src/lib/auth';

const newUser = {
    username: "john.doe",
    password: "securepassword123",
    quota: 5368709120, // 5GB in bytes
    rootDirectories: [
        {
            name: "/home",
            physicalPath: "/home/john.doe",
            roles: ["canRead", "canWrite"]
        },
        {
            name: "/shared",
            physicalPath: "/shared/documents",
            roles: ["canRead"]
        }
    ]
};

const success = await addUser(newUser);
if (success) {
    console.log("User added successfully");
} else {
    console.log("Failed to add user");
}
```

### 2. removeUser(username: string): Promise<boolean>

Removes a user from the users_config.json file.

#### Example Usage:
```typescript
import { removeUser } from './src/lib/auth';

const success = await removeUser("john.doe");
if (success) {
    console.log("User removed successfully");
} else {
    console.log("Failed to remove user or user not found");
}
```

### 3. updateUser(username: string, userData: Partial<NewUserData>): Promise<boolean>

Updates an existing user's data. You can update any field except the username.

#### Example Usage:
```typescript
import { updateUser } from './src/lib/auth';

// Update password and quota
const success = await updateUser("john.doe", {
    password: "newpassword456",
    quota: 10737418240 // 10GB
});

// Add a new root directory
const success2 = await updateUser("john.doe", {
    rootDirectories: [
        {
            name: "/home",
            physicalPath: "/home/john.doe",
            roles: ["canRead", "canWrite"]
        },
        {
            name: "/shared",
            physicalPath: "/shared/documents",
            roles: ["canRead"]
        },
        {
            name: "/projects",
            physicalPath: "/projects/john.doe",
            roles: ["canWrite", "all"]
        }
    ]
});
```

### 4. getAllUsers(): Array<User>

Returns all users from the configuration.

#### Example Usage:
```typescript
import { getAllUsers } from './src/lib/auth';

const users = getAllUsers();
console.log(`Total users: ${users.length}`);
users.forEach(user => {
    console.log(`User: ${user.username}, Quota: ${user.quota} bytes`);
});
```

### 5. getUser(username: string): User | undefined

Returns a specific user by username.

#### Example Usage:
```typescript
import { getUser } from './src/lib/auth';

const user = getUser("john.doe");
if (user) {
    console.log(`Found user: ${user.username}`);
    console.log(`Root directories: ${user.rootDirectories.length}`);
} else {
    console.log("User not found");
}
```

### 6. userExists(username: string): boolean

Checks if a user exists in the configuration.

#### Example Usage:
```typescript
import { userExists } from './src/lib/auth';

if (userExists("john.doe")) {
    console.log("User exists");
} else {
    console.log("User does not exist");
}
```

## Integration with Express Routes

You can use these functions in your Express routes for user management:

### Example: User Management API Routes

```typescript
// In src/routes/users.ts (new file)
import * as express from "express";
import { addUser, removeUser, updateUser, getAllUsers, getUser, userExists, NewUserData } from '../lib/auth';

export const register = (app: express.Application): void => {
    
    // Get all users
    app.get("/api/users", (req, res) => {
        try {
            const users = getAllUsers();
            // Remove passwords from response for security
            const safeUsers = users.map(user => ({
                username: user.username,
                quota: user.quota,
                rootDirectories: user.rootDirectories
            }));
            res.json(safeUsers);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get users' });
        }
    });

    // Get specific user
    app.get("/api/users/:username", (req, res) => {
        try {
            const username = req.params.username;
            const user = getUser(username);
            if (user) {
                // Remove password from response for security
                const safeUser = {
                    username: user.username,
                    quota: user.quota,
                    rootDirectories: user.rootDirectories
                };
                res.json(safeUser);
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to get user' });
        }
    });

    // Add new user
    app.post("/api/users", async (req, res) => {
        try {
            const userData: NewUserData = req.body;
            
            // Validate required fields
            if (!userData.username || !userData.password || !userData.rootDirectories) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const success = await addUser(userData);
            if (success) {
                res.status(201).json({ message: 'User created successfully' });
            } else {
                res.status(400).json({ error: 'Failed to create user (user may already exist)' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    // Update user
    app.put("/api/users/:username", async (req, res) => {
        try {
            const username = req.params.username;
            const userData = req.body;

            if (!userExists(username)) {
                return res.status(404).json({ error: 'User not found' });
            }

            const success = await updateUser(username, userData);
            if (success) {
                res.json({ message: 'User updated successfully' });
            } else {
                res.status(400).json({ error: 'Failed to update user' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to update user' });
        }
    });

    // Delete user
    app.delete("/api/users/:username", async (req, res) => {
        try {
            const username = req.params.username;

            if (!userExists(username)) {
                return res.status(404).json({ error: 'User not found' });
            }

            const success = await removeUser(username);
            if (success) {
                res.json({ message: 'User deleted successfully' });
            } else {
                res.status(400).json({ error: 'Failed to delete user' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });
};
```

## Important Notes

### 1. File System Permissions
- Ensure the application has write permissions to the `users_config.json` file
- The file is located at the project root level

### 2. Memory vs File Synchronization
- Changes are immediately written to the file
- The in-memory `usersConfig` object is updated
- **Important**: If you restart the application, you need to reload the configuration

### 3. Security Considerations
- Always validate user input before calling these functions
- Consider implementing proper authentication/authorization for user management endpoints
- Never expose passwords in API responses
- Validate physical paths to prevent directory traversal attacks

### 4. Error Handling
- All functions return boolean values or throw errors
- Check return values to ensure operations succeeded
- Log errors appropriately for debugging

### 5. Quota Format
- Quota is specified in bytes
- Default quota is 1GB (1073741824 bytes) if not specified
- Common values:
  - 1GB = 1073741824
  - 5GB = 5368709120
  - 10GB = 10737418240

### 6. Root Directory Roles
Common role values:
- `"canRead"` - Read-only access
- `"canWrite"` - Write access
- `"all"` - Full access
- Custom roles as needed

## Example: Complete User Management Workflow

```typescript
import { addUser, getUser, updateUser, removeUser, userExists } from './src/lib/auth';

async function userManagementExample() {
    // 1. Check if user exists
    if (userExists("testuser")) {
        console.log("User already exists");
        return;
    }

    // 2. Add a new user
    const newUser = {
        username: "testuser",
        password: "testpass123",
        quota: 2147483648, // 2GB
        rootDirectories: [
            {
                name: "/home",
                physicalPath: "/home/testuser",
                roles: ["canRead", "canWrite"]
            }
        ]
    };

    let success = await addUser(newUser);
    console.log(`Add user: ${success}`);

    // 3. Get user details
    const user = getUser("testuser");
    console.log(`User details:`, user);

    // 4. Update user quota
    success = await updateUser("testuser", {
        quota: 5368709120 // Increase to 5GB
    });
    console.log(`Update user: ${success}`);

    // 5. Remove user
    success = await removeUser("testuser");
    console.log(`Remove user: ${success}`);
}
```

This implementation provides a complete user management system that integrates seamlessly with the existing nico.drive authentication and authorization system.
