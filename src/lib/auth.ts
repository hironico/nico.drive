import usersConfig from '../../users_config.json';

const findPhysicalPath = (username: string, homeDir: string): string => {
    const homeDirPhysicalPath: string[][] = usersConfig.users.filter(user => user.username === username).map(user => {            
        return user.rootDirectories.filter(rootDir => rootDir.name === homeDir).map(rootDir => rootDir.physicalPath);
    });

    return homeDirPhysicalPath[0][0];
}

export default findPhysicalPath;