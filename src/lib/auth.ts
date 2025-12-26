import fs from 'fs';
import path from 'path';
import { Express } from 'express';
import { v2 as webdav, IUser } from "webdav-server";
import { dirSize } from './fileutils';
import { UserConfig, UserConfigFile } from '../models/UserConfig';
import { unescape } from 'querystring';

export const loadUsers = () : UserConfigFile => {
    const configPath = path.join(process.env.DAV_USERS_CONFIG);
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data) as UserConfigFile;
}

export const saveUsers = (usersConfig: UserConfigFile) => {
    const configPath = path.join(process.env.DAV_USERS_CONFIG);
    fs.writeFileSync(configPath, JSON.stringify(usersConfig, null, 4), 'utf8');
}

export const findPhysicalPath = (username: string, homeDir: string): string => {
    const myHomeDir = unescape(homeDir);
    // console.log(`Find physical path for user ${username} and homedir : ${myHomeDir}`);
    const usersConfig = loadUsers();
    const homeDirPhysicalPath: string[][] = usersConfig.users.filter(user => user.username === username).map(user => {            
        return user.rootDirectories.filter(rootDir => rootDir.name === myHomeDir).map(rootDir => rootDir.physicalPath);
    });

    return homeDirPhysicalPath[0][0];
}

export const basicAuthHandler = (usr: string, pwd: string) : boolean => {
    // console.log(`Check basic auth for user: ${usr}`);
    // console.log(`Usrs config has ${usersConfig.users.length} registered users.`);

    const usersConfig = loadUsers();

    const matchingUsers = usersConfig.users.filter(user => user.username === usr);
    if (typeof matchingUsers === 'undefined' || matchingUsers.length !== 1) {
        return false;
    }
    
    const user = matchingUsers[0];
    return user.password === pwd;
}

/**
 * Test if a user has a certain role on a root directory name.
 * @param usr tested user
 * @param roles the tested roles array against the user defined roles
 * @param rootDirName root dir name on which we want to know if this user has, at least one of the roles provided
 * @returns true if the user exists and the root directory exists for that user and the user has at least one of provided roles on this root directory. false otherwise.
 */
export const hasOneOfRoles = (usr: string, roles: Array<string>, rootDirName: string): boolean => {
    const usersConfig = loadUsers();
    const matchingUsers = usersConfig.users.filter(user => user.username === usr);
    if (typeof matchingUsers === 'undefined' || matchingUsers.length !== 1) {
        return false;
    }

    const user = matchingUsers[0];

    const matchingRootDirs = user.rootDirectories.filter(rootDir => rootDir.name === rootDirName);
    if (typeof matchingRootDirs === 'undefined' || matchingRootDirs.length !== 1) {
        return false;
    }

    const rootDir = matchingRootDirs[0];

    for(const role of roles) {
        if (rootDir.roles.indexOf(role) >= 0) {
            return true;
        }
    }

    return false;

}

/**
 * Add a new user to the users_config.json file
 * @param userData The user data to add
 * @returns Promise<boolean> true if user was added successfully, false otherwise
 */
export const addUser = async (userData: UserConfig): Promise<boolean> => {
    try {

        const usersConfig = loadUsers();

        // Check if user already exists
        const existingUser = usersConfig.users.find(user => user.username === userData.username);
        if (existingUser) {
            console.error(`User ${userData.username} already exists`);
            return false;
        }

        // Create new user object
        const newUser: UserConfig  = {
            username: userData.username,
            password: userData.password,
            quota: (userData.quota * 1073741824) || 1073741824, // quota in GB x 1073741824; Default 1GB if not specified
            rootDirectories: userData.rootDirectories,
            uid: userData.uid,
            isAdministrator: userData.isAdministrator,
            isDefaultUser: userData.isDefaultUser
        };

        // Add user to the config
        usersConfig.users.push(newUser);

        saveUsers(usersConfig);
        
        console.log(`User ${userData.username} added successfully. DAV Server user config must be refreshed.`);
        return true;
    } catch (error) {
        console.error('Error adding user:', error);
        return false;
    }
};

/**
 * Remove a user from the users_config.json file
 * @param username The username to remove
 * @returns Promise<boolean> true if user was removed successfully, false otherwise
 */
export const removeUser = async (username: string): Promise<boolean> => {
    try {
        const usersConfig = loadUsers();
        
        // Find user index
        const userIndex = usersConfig.users.findIndex(user => user.username === username);
        if (userIndex === -1) {
            console.error(`User ${username} not found`);
            return false;
        }

        // Remove user from the config
        usersConfig.users.splice(userIndex, 1);

        // Write updated config to file
        saveUsers(usersConfig);
        
        console.log(`User ${username} removed successfully`);
        return true;
    } catch (error) {
        console.error('Error removing user:', error);
        return false;
    }
};

/**
 * Update an existing user in the users_config.json file
 * @param username The username to update
 * @param userData The updated user data
 * @returns Promise<boolean> true if user was updated successfully, false otherwise
 */
export const updateUser = async (username: string, userData: Partial<UserConfig>): Promise<boolean> => {
    try {
        const usersConfig = loadUsers();
        
        // Find user
        const userIndex = usersConfig.users.findIndex(user => user.username === username);
        if (userIndex === -1) {
            console.error(`User ${username} not found`);
            return false;
        }

        // Update user data
        const existingUser = usersConfig.users[userIndex];
        usersConfig.users[userIndex] = {
            ...existingUser,
            ...userData,
            username: existingUser.username // Prevent username changes
        };

        // Write updated config to file
        saveUsers(usersConfig);
        
        console.log(`User ${username} updated successfully`);
        return true;
    } catch (error) {
        console.error('Error updating user:', error);
        return false;
    }
};

/**
 * Get all users from the config
 * @returns Array of user objects
 */
export const getAllUsers = () => {    
    return loadUsers().users;
};

/**
 * Get a specific user by username
 * @param username The username to find
 * @returns User object or undefined if not found
 */
export const getUser = (username: string) => {
    return loadUsers().users.find(user => user.username === username);
};

/**
 * Check if a user exists
 * @param username The username to check
 * @returns boolean true if user exists, false otherwise
 */
export const userExists = (username: string): boolean => {
    return loadUsers().users.some(user => user.username === username);
};

/**
 * Configure privileges for shared directories based on public flag and specific shares
 * @param app Express server application with privilegeManager
 */
export const configureSharedDirectoryPrivileges = (app: Express): void => {
    const usersConfig = loadUsers();
    
    // Iterate through all users and their directories
    usersConfig.users.forEach(owner => {
        owner.rootDirectories.forEach(rootDir => {
            const rootDirPath = rootDir.name.startsWith('/') ? `/${owner.username}${rootDir.name}` : `/${owner.username}/${rootDir.name}`;
            
            // Handle public directories - give read access to all other users
            if (rootDir.isPublic === true) {
                console.log(`Setting up public read access for: ${rootDirPath}`);
                usersConfig.users.forEach(otherUser => {
                    if (otherUser.uid !== owner.uid) {
                        app.locals.userManager.getUserByName(otherUser.username, (error: Error, managedUser: IUser) => {
                            if (!error && managedUser) {
                                app.locals.privilegeManager.setRights(managedUser, rootDirPath, ['canRead']);
                                console.log(`  -> Granted read access to ${otherUser.username} for ${rootDirPath}`);
                            }
                        });
                    }
                });
            }
            
            // Handle specific user shares
            if (rootDir.shares && rootDir.shares.length > 0) {
                rootDir.shares.forEach(share => {
                    // Find the target user
                    const targetUser = usersConfig.users.find(u => u.uid === share.uid);
                    if (targetUser) {
                        app.locals.userManager.getUserByName(targetUser.username, (error: Error, managedUser: IUser) => {
                            if (!error && managedUser) {
                                const roles = share.access === 'canWrite' ? ['canRead', 'canWrite'] : ['canRead'];
                                app.locals.privilegeManager.setRights(managedUser, rootDirPath, roles);
                                console.log(`Granted ${share.access} access to ${targetUser.username} for ${rootDirPath}`);
                            }
                        });
                    }
                });
            }
        });
    });
};

/**
 * Reset the quota and privileges for all users from the users config file into the express application.
 * @param app Express server application to update locals privilegeManager and quotaManager
 */
export const refreshUserConfig = (app: Express) : void => {
    loadUsers().users.forEach(user => {

    // configure users for app
    console.log('Setup DAV user : ' + user.username);
    
    // Get existing user or add new one
    let managedUser: IUser;
    app.locals.userManager.getUserByName(user.username, (error: Error, existingUser: IUser) => {
        if (existingUser) {
            managedUser = existingUser;
            console.log(`Updating existing user: ${user.username}`);
        } else {
            managedUser = app.locals.userManager.addUser(user.username, user.password, false);
            console.log(`Adding new user: ${user.username}`);
        }
    });
    
    // If managedUser is not set (synchronous issue), try adding
    if (!managedUser) {
        managedUser = app.locals.userManager.addUser(user.username, user.password, false);
    }

    // configure privileges for the root directories mapped names of that user. 
    let currentReservedBytes = 0;
    user.rootDirectories.forEach(rootDir => {
        const rootDirName = rootDir.name.startsWith('/') ? `/${user.username}${rootDir.name}` : `/${user.username}/${rootDir.name}`;
        app.locals.privilegeManager.setRights(managedUser, rootDirName, rootDir.roles);

        if (hasOneOfRoles(user.username, [ 'all', 'canWrite' ], rootDir.name)) {            
            // compute the total size in bytes of this root dir and add it to the current space reserved to this user.            
            const physicalPath = findPhysicalPath(user.username, rootDir.name);
            currentReservedBytes += dirSize(physicalPath);
        }

        // now map this root directory to a physical path in the webdav server.
        // configure physical path mapping for the root directories of all users.
        // the user's root directories are mounted under the user name as root for all directories.
        try {
                fs.statSync(rootDir.physicalPath);
    
                const rootDirName = rootDir.name.startsWith('/') ? `/${user.username}${rootDir.name}` : `/${user.username}/${rootDir.name}`;
    
                const webdavserver = app.locals.webdav as webdav.WebDAVServer;
                webdavserver.setFileSystem(rootDirName, new webdav.PhysicalFileSystem(rootDir.physicalPath), (success) => {
                    if (success) {
                        console.log(`User directory mounted: ${rootDirName} -> ${rootDir.physicalPath}`);
                    } else {
                        const errMsg = `Cannot map physical path: ${rootDir.physicalPath} into: ${rootDirName}`;
                        console.log(errMsg);
                        throw new Error(errMsg);
                    }
                });
            } catch (problem) {
                console.error(`ERROR: Configuration problem: Check the users_config.json configuration file and ensure that the physical path exists and is readable: ${rootDir.physicalPath}`);
            }
    });

    console.info(`Setting user quota: ${user.username} >>> ${currentReservedBytes} / ${user.quota * 1024 * 1024 * 1024} bytes.`);
    app.locals.quotaManager.setUserLimit(managedUser, user.quota * 1024 * 1024 * 1024);
    app.locals.quotaManager.setUserReserved(managedUser, currentReservedBytes);
});

    // After all users and directories are configured, set up shared directory privileges
    configureSharedDirectoryPrivileges(app);
}
