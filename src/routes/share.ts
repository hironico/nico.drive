import * as express from "express";
import { loadUsers, saveUsers, refreshUserConfig } from "../lib/auth";
import { IDirectoryShare } from "../models/IRootDirectory";

export const register = (app: express.Express): void => {
    // Middleware to ensure user is authenticated
    const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (!req.session || !req.session.user) {
            console.log('share auth middleware: user is not authenticated.');
            return res.status(401).json({ error: "Authentication required" });
        }
        next();
    };

    // Enable JSON body parsing for these routes
    const jsonParser = express.json();

    /**
     * GET /share - Get all shares for the authenticated user's directories
     */
    app.get("/share", requireAuth, (req, res) => {
        try {
            const username = req.session.user.username;
            const usersConfig = loadUsers();
            const user = usersConfig.users.find(u => u.username === username);

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Build response with directory shares, enriching each share with username
            const directoriesWithShares = user.rootDirectories.map(dir => {
                const enrichedShares = (dir.shares || []).map(share => {
                    // Find the user for this share
                    const sharedUser = usersConfig.users.find(u => u.uid === share.uid);
                    return {
                        uid: share.uid,
                        username: sharedUser ? sharedUser.username : `Unknown (${share.uid})`,
                        access: share.access
                    };
                });

                return {
                    name: dir.name,
                    physicalPath: dir.physicalPath,
                    shares: enrichedShares,
                    isPublic: dir.isPublic || false
                };
            });

            res.json({
                success: true,
                directories: directoriesWithShares
            });
        } catch (error) {
            console.error("Error getting shares:", error);
            res.status(500).json({ error: "Failed to retrieve shares" });
        }
    });

    /**
     * POST /share - Add or update a share for a directory
     * Body: {
     *   directoryName: string,
     *   targetUsername: string (username or email),
     *   access: 'canRead' | 'canWrite'
     * }
     */
    app.post("/share", requireAuth, jsonParser, (req, res) => {
        try {
            const username = req.session.user.username;
            const { directoryName, targetUsername, access } = req.body;

            // Validate input
            if (!directoryName || !targetUsername || !access) {
                return res.status(400).json({ 
                    error: "Missing required fields: directoryName, targetUsername, access" 
                });
            }

            if (access !== 'canRead' && access !== 'canWrite') {
                return res.status(400).json({ 
                    error: "Invalid access value. Must be 'canRead' or 'canWrite'" 
                });
            }

            const usersConfig = loadUsers();
            
            // Find the current user
            const user = usersConfig.users.find(u => u.username === username);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Find the target user by username (email support to be added when UserConfig includes it)
            const targetUser = usersConfig.users.find(u => 
                u.username === targetUsername
            );
            if (!targetUser) {
                return res.status(404).json({ 
                    error: `User '${targetUsername}' not found. Please check the username.` 
                });
            }

            // Prevent sharing with self
            if (user.uid === targetUser.uid) {
                return res.status(400).json({ error: "Cannot share directory with yourself" });
            }

            // Find the directory
            const directory = user.rootDirectories.find(d => d.name === directoryName);
            if (!directory) {
                return res.status(404).json({ 
                    error: `Directory '${directoryName}' not found` 
                });
            }

            // Initialize shares array if it doesn't exist
            if (!directory.shares) {
                directory.shares = [];
            }

            // Check if share already exists for this user
            const existingShareIndex = directory.shares.findIndex(s => s.uid === targetUser.uid);
            
            if (existingShareIndex >= 0) {
                // Update existing share
                directory.shares[existingShareIndex].access = access;
                console.log(`Updated share for directory '${directoryName}' with user ${targetUser.username} (${targetUser.uid}) - access: ${access}`);
            } else {
                // Add new share
                const newShare: IDirectoryShare = {
                    uid: targetUser.uid,
                    access: access
                };
                directory.shares.push(newShare);
                console.log(`Added share for directory '${directoryName}' with user ${targetUser.username} (${targetUser.uid}) - access: ${access}`);
            }

            // Save updated configuration
            saveUsers(usersConfig);

            // Reload WebDAV server configuration
            refreshUserConfig(app);

            res.json({
                success: true,
                message: existingShareIndex >= 0 ? "Share updated successfully" : "Share added successfully",
                share: {
                    directoryName: directoryName,
                    targetUserUid: targetUser.uid,
                    targetUsername: targetUser.username,
                    access: access
                }
            });
        } catch (error) {
            console.error("Error adding/updating share:", error);
            res.status(500).json({ error: "Failed to add/update share" });
        }
    });

    /**
     * PUT /share/public - Toggle public sharing for a directory
     * Body: {
     *   directoryName: string,
     *   isPublic: boolean
     * }
     */
    app.put("/share/public", requireAuth, jsonParser, (req, res) => {
        try {
            const username = req.session.user.username;
            const { directoryName, isPublic } = req.body;

            // Validate input
            if (!directoryName || typeof isPublic !== 'boolean') {
                return res.status(400).json({ 
                    error: "Missing required fields: directoryName, isPublic (boolean)" 
                });
            }

            const usersConfig = loadUsers();
            
            // Find the current user
            const user = usersConfig.users.find(u => u.username === username);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Find the directory
            const directory = user.rootDirectories.find(d => d.name === directoryName);
            if (!directory) {
                return res.status(404).json({ 
                    error: `Directory '${directoryName}' not found` 
                });
            }

            // Update public status
            directory.isPublic = isPublic;
            console.log(`Set public status for directory '${directoryName}' to ${isPublic}`);

            // Save updated configuration
            saveUsers(usersConfig);

            // Reload WebDAV server configuration
            refreshUserConfig(app);

            res.json({
                success: true,
                message: isPublic ? "Directory is now public (read-only)" : "Directory is no longer public",
                isPublic: isPublic
            });
        } catch (error) {
            console.error("Error updating public status:", error);
            res.status(500).json({ error: "Failed to update public status" });
        }
    });

    /**
     * DELETE /share - Remove a share from a directory
     * Body: {
     *   directoryName: string,
     *   targetUserUid: string
     * }
     */
    app.delete("/share", requireAuth, jsonParser, (req, res) => {
        try {
            const username = req.session.user.username;
            const { directoryName, targetUserUid } = req.body;

            // Validate input
            if (!directoryName || !targetUserUid) {
                return res.status(400).json({ 
                    error: "Missing required fields: directoryName, targetUserUid" 
                });
            }

            const usersConfig = loadUsers();
            
            // Find the current user
            const user = usersConfig.users.find(u => u.username === username);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Find the directory
            const directory = user.rootDirectories.find(d => d.name === directoryName);
            if (!directory) {
                return res.status(404).json({ 
                    error: `Directory '${directoryName}' not found` 
                });
            }

            // Check if shares exist
            if (!directory.shares || directory.shares.length === 0) {
                return res.status(404).json({ 
                    error: "No shares found for this directory" 
                });
            }

            // Find and remove the share
            const shareIndex = directory.shares.findIndex(s => s.uid === targetUserUid);
            if (shareIndex < 0) {
                return res.status(404).json({ 
                    error: "Share not found for the specified user" 
                });
            }

            directory.shares.splice(shareIndex, 1);
            console.log(`Removed share for directory '${directoryName}' from user with uid ${targetUserUid}`);

            // Save updated configuration
            saveUsers(usersConfig);

            // Reload WebDAV server configuration
            refreshUserConfig(app);

            res.json({
                success: true,
                message: "Share removed successfully"
            });
        } catch (error) {
            console.error("Error removing share:", error);
            res.status(500).json({ error: "Failed to remove share" });
        }
    });
};
