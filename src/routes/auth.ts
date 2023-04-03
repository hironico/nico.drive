import * as express from "express";
import expressBasicAuth from "express-basic-auth";
import { basicAuthHandler } from "../lib/auth";
import { IUser } from "webdav-server";

import userConfig from '../../users_config.json';

class UserProfile {
    uid: string;
    username: string;
    isAdministrator: boolean;
    isDefaultUser: boolean;
    rootDirs: string[];
    quota: number;
    quotaUsed: number;

    static createFromConfig (name: string) : UserProfile {

        let profile = null;
        userConfig.users.forEach(user => {
            if (user.username === name) {
                profile = new UserProfile();
                profile.username = user.username;
                profile.rootDirs = user.rootDirectories.map(rootDir => rootDir.name);
                profile.quota = user.quota;
            }
        });

        return profile;
    }
}

export const register = (app: express.Application) : void => {

    const userManager = app.locals.userManager;
    const quotaManager = app.locals.quotaManager;

    // first protect the API using the basic Auth handler
    app.use('/auth', expressBasicAuth({ authorizer: basicAuthHandler }));

    app.get("/auth/whois/:username", (req, res) => {
        const username = req.params['username'];

        userManager.getUserByName(username, (error: Error, user: IUser) => {
            if (user) {
                const userProfile: UserProfile = UserProfile.createFromConfig(username);

                // very unlikely but never know ... 
                if(userProfile === null) {
                    const errMsg = `Should have found user: ${username} in the config file...`;
                    console.log(errMsg);
                    res.status(404).send(errMsg).end();
                    return;
                }

                // complete profile with info from user manager.
                userProfile.uid = user.uid;                
                userProfile.isAdministrator = user.isAdministrator;
                userProfile.isDefaultUser = user.isDefaultUser;

                // complete with quota info from auota manager
                const reserved = quotaManager.getUserReserved(user);
                userProfile.quotaUsed = reserved;

                res.status(200).send(userProfile);
            } else {
                res.status(404).send("User not found");
            }
        });
    });
};
