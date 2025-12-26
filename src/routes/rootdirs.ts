import * as express from "express";
import { loadUsers, saveUsers, refreshUserConfig } from "../lib/auth";
import { mkdirSync, rmSync, renameSync, existsSync } from "fs";
import path from "path";
import { IRootDirectory } from "../models/IRootDirectory";
import { dirSize } from "../lib/fileutils";
import dotenv from 'dotenv';

dotenv.config();

// Middleware to check if user is authenticated
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Validate directory name
const validateDirectoryName = (name: string): { valid: boolean; error?: string; normalized?: string } => {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'Directory name cannot be empty' };
    }

    // Normalize: ensure it starts with /
    let normalized = name.trim();
    if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
    }

    // Check for special characters (allow only alphanumeric, spaces, hyphens, underscores, and forward slashes)
    const specialCharsRegex = /[^a-zA-Z0-9\s\-_/]/;
    if (specialCharsRegex.test(normalized)) {
        return { valid: false, error: 'Directory name contains invalid characters. Only letters, numbers, spaces, hyphens, and underscores are allowed.' };
    }

    // Check for multiple consecutive slashes
    if (/\/\/+/.test(normalized)) {
        return { valid: false, error: 'Directory name cannot contain consecutive slashes' };
    }

    // Check if name ends with slash (not allowed except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
        return { valid: false, error: 'Directory name cannot end with a slash' };
    }

    return { valid: true, normalized };
};

export const register = (app: express.Express): void => {
    
    // Get all root directories for current user
    app.get("/rootdirs", requireAuth, (req, res) => {
        try {
            const username = req.session.user.username;
            const usersConfig = loadUsers();
            const user = usersConfig.users.find(u => u.username === username);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Return sanitized root directories with size calculation and enriched shares
            const rootDirs = user.rootDirectories.map(dir => {
                let sizeInBytes = 0;
                try {
                    if (existsSync(dir.physicalPath)) {
                        sizeInBytes = dirSize(dir.physicalPath);
                    }
                } catch (error) {
                    console.error(`Error calculating size for ${dir.physicalPath}:`, error);
                }

                // Enrich shares with usernames
                const enrichedShares = (dir.shares || []).map(share => {
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
                    size: sizeInBytes, // Size in bytes
                    roles: dir.roles,
                    isPublic: dir.isPublic || false,
                    shares: enrichedShares
                };
            });

            res.json(rootDirs);
        } catch (error) {
            console.error('Error fetching root directories:', error);
            res.status(500).json({ error: 'Failed to fetch root directories' });
        }
    });

    // Create new root directory
    app.post("/rootdirs", requireAuth, async (req, res) => {
        try {
            const username = req.session.user.username;
            const { name } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Directory name is required' });
            }

            // Validate and normalize name
            const validation = validateDirectoryName(name);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            const normalizedName = validation.normalized!;

            // Load users config
            const usersConfig = loadUsers();
            const user = usersConfig.users.find(u => u.username === username);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check if directory name already exists for this user
            const nameExists = user.rootDirectories.some(dir => dir.name === normalizedName);
            if (nameExists) {
                return res.status(409).json({ error: 'A root directory with this name already exists' });
            }

            // Create physical directory path
            const dataHome = process.env.DAV_DATA_HOME || '/tmp/nicodrive';
            // Remove leading slash from normalized name for path construction
            const dirName = normalizedName.substring(1);
            const physicalPath = path.join(dataHome, user.uid, dirName);

            // Check if physical path already exists
            if (existsSync(physicalPath)) {
                return res.status(409).json({ error: 'Physical directory already exists' });
            }

            // Create the physical directory
            try {
                mkdirSync(physicalPath, { recursive: true });
            } catch (error) {
                console.error(`Failed to create directory ${physicalPath}:`, error);
                return res.status(500).json({ error: 'Failed to create physical directory' });
            }

            // Create new root directory entry
            const newRootDir: IRootDirectory = {
                name: normalizedName,
                physicalPath: physicalPath,
                roles: ['all', 'canWrite'], // Default: full access for owner
                isPublic: false,
                shares: []
            };

            // Add to user's root directories
            user.rootDirectories.push(newRootDir);

            // Save configuration
            saveUsers(usersConfig);

            // Refresh WebDAV server configuration
            refreshUserConfig(app);

            res.status(201).json({
                message: 'Root directory created successfully',
                rootDirectory: newRootDir
            });
        } catch (error) {
            console.error('Error creating root directory:', error);
            res.status(500).json({ error: 'Failed to create root directory' });
        }
    });

    // Rename root directory
    app.put("/rootdirs/:encodedName", requireAuth, async (req, res) => {
        try {
            const username = req.session.user.username;
            const oldName = decodeURIComponent(req.params.encodedName);
            const { newName } = req.body;

            if (!newName) {
                return res.status(400).json({ error: 'New directory name is required' });
            }

            // Validate and normalize new name
            const validation = validateDirectoryName(newName);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            const normalizedNewName = validation.normalized!;

            // Load users config
            const usersConfig = loadUsers();
            const user = usersConfig.users.find(u => u.username === username);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Find the directory to rename
            const dirIndex = user.rootDirectories.findIndex(dir => dir.name === oldName);
            if (dirIndex === -1) {
                return res.status(404).json({ error: 'Root directory not found' });
            }

            // Check if new name already exists (and is different from old name)
            if (normalizedNewName !== oldName) {
                const nameExists = user.rootDirectories.some(dir => dir.name === normalizedNewName);
                if (nameExists) {
                    return res.status(409).json({ error: 'A root directory with this name already exists' });
                }
            }

            const oldDir = user.rootDirectories[dirIndex];
            const dataHome = process.env.DAV_DATA_HOME || '/tmp/nicodrive';
            
            // Calculate new physical path
            const newDirName = normalizedNewName.substring(1);
            const newPhysicalPath = path.join(dataHome, user.uid, newDirName);

            // Rename physical directory if it exists and path changed
            if (oldDir.physicalPath !== newPhysicalPath) {
                if (existsSync(oldDir.physicalPath)) {
                    try {
                        renameSync(oldDir.physicalPath, newPhysicalPath);
                    } catch (error) {
                        console.error(`Failed to rename directory from ${oldDir.physicalPath} to ${newPhysicalPath}:`, error);
                        return res.status(500).json({ error: 'Failed to rename physical directory' });
                    }
                }
            }

            // Update directory entry
            user.rootDirectories[dirIndex] = {
                ...oldDir,
                name: normalizedNewName,
                physicalPath: newPhysicalPath
            };

            // Save configuration
            saveUsers(usersConfig);

            // Refresh WebDAV server configuration
            refreshUserConfig(app);

            res.json({
                message: 'Root directory renamed successfully',
                rootDirectory: user.rootDirectories[dirIndex]
            });
        } catch (error) {
            console.error('Error renaming root directory:', error);
            res.status(500).json({ error: 'Failed to rename root directory' });
        }
    });

    // Delete root directory
    app.delete("/rootdirs/:encodedName", requireAuth, async (req, res) => {
        try {
            const username = req.session.user.username;
            const dirName = decodeURIComponent(req.params.encodedName);

            // Load users config
            const usersConfig = loadUsers();
            const user = usersConfig.users.find(u => u.username === username);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Find the directory to delete
            const dirIndex = user.rootDirectories.findIndex(dir => dir.name === dirName);
            if (dirIndex === -1) {
                return res.status(404).json({ error: 'Root directory not found' });
            }

            // Prevent deletion if it's the last root directory
            if (user.rootDirectories.length === 1) {
                return res.status(400).json({ error: 'Cannot delete the last root directory' });
            }

            const dirToDelete = user.rootDirectories[dirIndex];

            // Delete physical directory and its contents
            if (existsSync(dirToDelete.physicalPath)) {
                try {
                    rmSync(dirToDelete.physicalPath, { recursive: true, force: true });
                    console.log(`Deleted physical directory: ${dirToDelete.physicalPath}`);
                } catch (error) {
                    console.error(`Failed to delete physical directory ${dirToDelete.physicalPath}:`, error);
                    return res.status(500).json({ error: 'Failed to delete physical directory' });
                }
            } else {
                console.error(`Could not delete the root directory: ${dirToDelete.physicalPath}. Not found.`);
                return res.status(400).json({error: 'Cannot find the root directory physical path to delete.'});
            }

            // Remove directory from user's root directories
            user.rootDirectories.splice(dirIndex, 1);

            // Save configuration
            saveUsers(usersConfig);

            // Refresh WebDAV server configuration
            refreshUserConfig(app);

            res.json({ message: 'Root directory deleted successfully' });
        } catch (error) {
            console.error('Error deleting root directory:', error);
            res.status(500).json({ error: 'Failed to delete root directory' });
        }
    });
};
