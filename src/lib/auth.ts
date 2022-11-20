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
