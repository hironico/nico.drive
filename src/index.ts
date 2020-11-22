import { v2 as webdav } from 'webdav-server';
import dotenv from "dotenv";
import express from "express";
import https from "https";
import fs from "fs";

import * as authApi from "./routes/auth";

// init environment configuration
dotenv.config();

const app = express();

// available from configuration file .env
const port = process.env.SERVER_PORT;

// define a route handler for the default home page
app.get("/", (req, res) => {
    res.send("This is nico.drive web user interface. Come back later to see how great this interface performs when it is finished!");
});

// User manager (tells who are the users)
const userManager = new webdav.SimpleUserManager();

// add user manager to locals to retreive it from routes
app.locals.userManager = userManager;

// configure users for app
console.log('Creating DAV user : ' + process.env.DAV_USER + ' / ' + process.env.DAV_PASSWORD);

const user = userManager.addUser(process.env.DAV_USER, process.env.DAV_PASSWORD, false);
const adminUser = userManager.addUser('davadmin', 'BLAbla123_davadmin', true);

// Privilege manager (tells which users can access which files/folders)
const privilegeManager = new webdav.SimplePathPrivilegeManager();

// add privilege manager to locals to retreive it from routes
app.locals.privilegeManager = privilegeManager;

// configure privileges
privilegeManager.setRights(user, process.env.DAV_MAPPED_PATH, [ 'all' ]);
privilegeManager.setRights(adminUser, '/',  ['all' ]);

// now configure routes
authApi.register(app);

const server = new webdav.WebDAVServer({
    // HTTP Digest authentication with the realm 'Default realm'
    // httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
    // basic auth only for synology cloud sync
    httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, 'Default realm'),
    privilegeManager: privilegeManager
});

// display some logs if required.
server.afterRequest((arg, next) => {
    const debugAfterRequest = process.env.LOG_AFTER_REQUEST;
    if (debugAfterRequest !== '1') {
        next();
        return;
    }

    // Display the method, the URI, the returned status code and the returned message
    console.log('>>', arg.request.method, arg.requested.uri, '>', arg.response.statusCode, arg.response.statusMessage);
    // If available, display the body of the response
    console.log(arg.responseBody ? arg.responseBody : 'no response body');
    next();
});

const localPhysicalPath = process.env.DAV_PHYSICAL_PATH;
server.setFileSystem(process.env.DAV_MAPPED_PATH, new webdav.PhysicalFileSystem(localPhysicalPath), (success) => {
    if (success) {
        console.log('Successfully loaded the physical path : ' + localPhysicalPath);
    } else {
        console.log('ERROR: could not load the physical path: ' + localPhysicalPath);
    }
});

// activate webdav server with the specified path to store files.
app.use(webdav.extensions.express(process.env.DAV_WEB_CONTEXT, server));

// create HTTPS server.
// to create a self signed cert use the following command:
// openssl req -nodes -new -x509 -keyout server.key -out server.cert
https.createServer({
    key: fs.readFileSync(process.env.SERVER_SSL_KEY_FILE),
    cert: fs.readFileSync(process.env.SERVER_SSL_CERT_FILE)
}, app).listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at https://localhost:${port}`);
});