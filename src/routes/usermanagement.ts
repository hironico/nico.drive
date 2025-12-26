import * as express from "express";
import { getAllUsers, addUser, updateUser, removeUser, refreshUserConfig } from "../lib/auth";
import { UserConfig } from "../models/UserConfig";
import { randomUUID } from "crypto";
import { mkdirSync, rmSync } from "fs";
import { IRootDirectory } from "../models/IRootDirectory";

// Middleware to check if user is authenticated and has admin role
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasAdminRole = req.session.user.roles?.includes('nicodrive-admin');
    if (!hasAdminRole) {
        return res.status(403).json({ error: 'Forbidden: Admin role required' });
    }

    next();
};

export const register = (app: express.Express): void => {
    
    // Get all users (admin only)
    app.get("/users", requireAdmin, (req, res) => {
        try {
            const users = getAllUsers();
            
            // Remove sensitive information (passwords) and add quota used
            const sanitizedUsers = users.map(user => {
                // Get quota used from quota manager
                let quotaUsedBytes = 0;
                try {
                    app.locals.userManager.getUserByName(user.username, (error: Error, managedUser: any) => {
                        if (!error && managedUser) {
                            quotaUsedBytes = app.locals.quotaManager.getUserReserved(managedUser);
                        }
                    });
                } catch (error) {
                    console.error(`Error getting quota for user ${user.username}:`, error);
                }

                return {
                    uid: user.uid,
                    username: user.username,
                    isAdministrator: user.isAdministrator,
                    isDefaultUser: user.isDefaultUser,
                    quota: user.quota, // Already in GB in config
                    quotaUsed: quotaUsedBytes / (1024 * 1024 * 1024), // Convert bytes to GB
                    rootDirectories: user.rootDirectories.map(dir => ({
                        name: dir.name,
                        physicalPath: dir.physicalPath,
                        roles: dir.roles,
                        isPublic: dir.isPublic,
                        shares: dir.shares
                    }))
                };
            });

            res.json(sanitizedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    // Get a specific user (admin only)
    app.get("/users/:username", requireAdmin, (req, res) => {
        try {
            const users = getAllUsers();
            const user = users.find(u => u.username === req.params.username);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get quota used from quota manager
            let quotaUsedBytes = 0;
            try {
                app.locals.userManager.getUserByName(user.username, (error: Error, managedUser: any) => {
                    if (!error && managedUser) {
                        quotaUsedBytes = app.locals.quotaManager.getUserReserved(managedUser);
                    }
                });
            } catch (error) {
                console.error(`Error getting quota for user ${user.username}:`, error);
            }

            // Remove sensitive information
            const sanitizedUser = {
                uid: user.uid,
                username: user.username,
                isAdministrator: user.isAdministrator,
                isDefaultUser: user.isDefaultUser,
                quota: user.quota, // Already in GB in config
                quotaUsed: quotaUsedBytes / (1024 * 1024 * 1024), // Convert bytes to GB
                rootDirectories: user.rootDirectories.map(dir => ({
                    name: dir.name,
                    physicalPath: dir.physicalPath,
                    roles: dir.roles,
                    isPublic: dir.isPublic,
                    shares: dir.shares
                }))
            };

            res.json(sanitizedUser);
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    });

    // Create a new user (admin only)
    app.post("/api/users", requireAdmin, async (req, res) => {
        try {
            const { username, password, quota, isAdministrator } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            // Check if user already exists
            const users = getAllUsers();
            if (users.find(u => u.username === username)) {
                return res.status(409).json({ error: 'User already exists' });
            }

            const newUser = new UserConfig();
            newUser.uid = randomUUID();
            newUser.username = username;
            newUser.password = password;
            newUser.isAdministrator = isAdministrator || false;
            newUser.isDefaultUser = false;
            newUser.quota = quota || 1; // in GB

            // Create user's home directory
            const dataHome = process.env.DAV_DATA_HOME ? `${process.env.DAV_DATA_HOME}/${newUser.uid}` : `/home/${newUser.uid}`;
            const defaultRootDirPhysicalPath = `${dataHome}/cloudy_drive`;
            
            try {
                const firstPath = mkdirSync(defaultRootDirPhysicalPath, { recursive: true });
                if (!firstPath) {
                    return res.status(500).json({ error: `Unable to create user home directory: ${dataHome}` });
                }
            } catch (error) {
                console.error(`Cannot create new user's home directory: ${error}`);
                return res.status(500).json({ error: 'Failed to create user directory' });
            }

            // Create default root directory
            const rootDirectories = new Array<IRootDirectory>();
            const defaultRootDir: IRootDirectory = {
                physicalPath: defaultRootDirPhysicalPath,
                name: "Cloudy Drive",
                roles: ['all', 'canWrite']
            };
            rootDirectories.push(defaultRootDir);
            newUser.rootDirectories = rootDirectories;

            // Add user to config
            const success = await addUser(newUser);
            if (!success) {
                return res.status(500).json({ error: 'Failed to add user' });
            }

            // Refresh server configuration
            refreshUserConfig(app);

            res.status(201).json({
                message: 'User created successfully',
                username: newUser.username
            });
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    // Update a user (admin only)
    app.put("/users/:username", requireAdmin, async (req, res) => {
        try {
            const { username } = req.params;
            const { password, quota, isAdministrator } = req.body;

            // Check if user exists
            const users = getAllUsers();
            const existingUser = users.find(u => u.username === username);
            if (!existingUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prepare update data
            const updateData: Partial<UserConfig> = {};
            if (password !== undefined) updateData.password = password;
            if (quota !== undefined) updateData.quota = quota; // in GB
            if (isAdministrator !== undefined) updateData.isAdministrator = isAdministrator;

            // Update user
            const success = await updateUser(username, updateData);
            if (!success) {
                return res.status(500).json({ error: 'Failed to update user' });
            }

            // Refresh server configuration
            refreshUserConfig(app);

            res.json({ message: 'User updated successfully' });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Failed to update user' });
        }
    });

    // Delete a user (admin only)
    app.delete("/users/:username", requireAdmin, async (req, res) => {
        try {
            const { username } = req.params;
            const { deleteFiles } = req.query;

            // Prevent deletion of default user or self
            if (req.session.user.username === username) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            // Check if user exists
            const users = getAllUsers();
            const userToDelete = users.find(u => u.username === username);
            if (!userToDelete) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (userToDelete.isDefaultUser) {
                return res.status(400).json({ error: 'Cannot delete default user' });
            }

            // Optionally delete user's files
            if (deleteFiles === 'true') {
                try {
                    const dataHome = process.env.DAV_DATA_HOME ? `${process.env.DAV_DATA_HOME}/${userToDelete.uid}` : `/home/${userToDelete.uid}`;
                    rmSync(dataHome, { recursive: true, force: true });
                    console.log(`Deleted user directory: ${dataHome}`);
                } catch (error) {
                    console.error(`Failed to delete user directory: ${error}`);
                    // Continue with user deletion even if file deletion fails
                }
            }

            // Remove user from config
            const success = await removeUser(username);
            if (!success) {
                return res.status(500).json({ error: 'Failed to remove user' });
            }

            // Refresh server configuration
            refreshUserConfig(app);

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });
};
