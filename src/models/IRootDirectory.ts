
export interface IDirectoryShare {
    uid: string;
    access: 'canRead' | 'canWrite';
}

export interface IRootDirectory {
    physicalPath: string;
    name: string;
    roles: Array<string>;
    shares?: Array<IDirectoryShare>;
    isPublic?: boolean; // If true, directory is shared with everyone (read-only)
}
