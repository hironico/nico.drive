import { IUser } from "webdav-server";
import { IRootDirectory } from "./IRootDirectory";

export class UserConfig implements IUser {
    uid: string;
    isAdministrator: boolean;
    isDefaultUser: boolean;
    password: string;
    username: string;
    rootDirectories: Array<IRootDirectory>;
    quota?: number;
}

export class UserConfigFile {
    users: Array<UserConfig>;
}