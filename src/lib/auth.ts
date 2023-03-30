import usersConfig from '../../users_config.json';

export const findPhysicalPath = (username: string, homeDir: string): string => {
    const homeDirPhysicalPath: string[][] = usersConfig.users.filter(user => user.username === username).map(user => {            
        return user.rootDirectories.filter(rootDir => rootDir.name === homeDir).map(rootDir => rootDir.physicalPath);
    });

    return homeDirPhysicalPath[0][0];
}

export const basicAuthHandler = (usr: string, pwd: string) : boolean => {
    // console.log(`Check basic auth for user: ${usr}`);
    // console.log(`Usrs config has ${usersConfig.users.length} registered users.`);

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
 * @param role the tested role against the user is tested
 * @param rootDirName root dir name on which we want to know if this user has a role
 * @returns true if the user exists and the root directory exists for that user and the user has that role on this root director. false otherwise.
 */
export const hasRole = (usr: string, role: string, rootDirName: string): boolean => {
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

    return rootDir.roles.indexOf(role) >= 0;
}
