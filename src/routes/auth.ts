import * as express from "express";
import { IUser } from "webdav-server";

class UserProfile {
    uid: string;
    username: string;
    isAdministrator: boolean;
    isDefaultUser: boolean;
}

export const register = (app: express.Application) : void => {

    const userManager = app.locals.userManager;

    app.get("/auth/whois/:username", (req, res) => {
        const username = req.params['username'];

        userManager.getUserByName(username, (error: Error, user: IUser) => {
            if (user) {
                const userProfile: UserProfile = new UserProfile();
                userProfile.uid = user.uid;
                userProfile.username = user.username;
                userProfile.isAdministrator = user.isAdministrator;
                userProfile.isDefaultUser = user.isDefaultUser;

                res.status(200).send(userProfile);
            } else {
                res.status(404).send("User not found");
            }
        });
    });
};
