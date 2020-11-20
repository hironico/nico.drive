import * as express from "express";
import { IUser } from "webdav-server";

export const register = (app: express.Application) : void => {

    const userManager = app.locals.userMAnager;

    app.get("/auth/whois/:username", (req, res) => {
        const username = req.params['username'];
        userManager.getUserByName(username, (error: Error, user: IUser) => {
            user ? res.status(200).send(JSON.stringify(user)) : res.status(404).send("User not found");
        });
    });
};
