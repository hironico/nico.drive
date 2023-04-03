import { v2 as webdav } from "webdav-server";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

import * as authApi from "./routes/auth";

import * as thumbApi from "./routes/thumb";

import * as metadataApi from "./routes/metadata";

import userConfig from '../users_config.json';
import { afterPUTListener } from "./requestlistener/afterPUTListener";
import { beforeDELETEListener } from "./requestlistener/beforeDELETEListener";
import { afterLogListener } from "./requestlistener/afterLogListener";
import { PerUserQuotaStorageManager } from "./lib/quota";
import { findPhysicalPath, hasOneOfRoles } from "./lib/auth";
import { dirSize } from "./lib/fileutils";

// if no .env file found then no need to go further
try {
    fs.statSync('.env');
} catch (problem) {
    console.log('Configuration file not found: .env : COPY and adapt the dotenv-sample file to create one.');
    process.exit(-99);
}

// init environment configuration
dotenv.config();

// now testing SSL cert files if SSL is actually enabled files ...
if (process.env.SERVER_SLL_ENABLED === 'true') {
    try {
        fs.statSync(process.env.SERVER_SSL_KEY_FILE);
        fs.statSync(process.env.SERVER_SSL_CERT_FILE);
    } catch (problem) {
        console.log('Check the .env configuration file and ensure the server cert and key files are present and readable.');
        process.exit(-89);
    }
}

const app = express();

// enable CORS for the webdav server to be used by a client in the browser.
// we use the regular cors methods plus thoses from RFC2518 aka webdav (6 last http methods)
const corsOptions = {
    origin: true,
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE,LOCK,UNLOCK",
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// available from configuration file .env
const port = process.env.SERVER_PORT;

// define a route handler for the client web app aka nico.drive.client
// see hironico GitHub project
const clientDir = path.join(__dirname, '..', process.env.CLIENT_ROOT_DIR);
console.log(`Client web application will be served from: ${clientDir}`);
app.use("/", express.static(clientDir));

// User manager (tells who are the users)
const userManager = new webdav.SimpleUserManager();

// add user manager to locals to retreive it from routes
app.locals.userManager = userManager;

// Privilege manager (tells which users can access which files/folders)
const privilegeManager = new webdav.SimplePathPrivilegeManager();

// add privilege manager to locals to retreive it from routes
app.locals.privilegeManager = privilegeManager;

// add the quota manager to the configuration
const FIVE_GIGS: number = 1024*1024*1024 * 5;
const quotaManager = new PerUserQuotaStorageManager(FIVE_GIGS);

// add privilege manager to locals to retreive it from routes
app.locals.quotaManager = quotaManager;

userConfig.users.forEach(user => {

    // configure users for app
    console.log('Creating DAV user : ' + user.username);
    const managedUser = userManager.addUser(user.username, user.password, false);

    // configure privileges for the root directories mapped names of that user. 
    let currentReservedBytes = 0;
    user.rootDirectories.forEach(rootDir => {
        const rootDirName = rootDir.name.startsWith('/') ? `/${user.username}${rootDir.name}` : `/${user.username}/${rootDir.name}`;
        privilegeManager.setRights(managedUser, rootDirName, rootDir.roles);

        if (hasOneOfRoles(user.username, [ 'all', 'canWrite' ], rootDir.name)) {            
            // compute the total size in bytes of this root dir and add it to the current space reserved to this user.            
            const physicalPath = findPhysicalPath(user.username, rootDir.name);
            currentReservedBytes += dirSize(physicalPath);
        }
    });

    console.info(`Setting user quota: ${user.username} >>> ${currentReservedBytes} / ${user.quota} bytes.`);
    quotaManager.setUserLimit(managedUser, user.quota);
    quotaManager.setUserReserved(managedUser, currentReservedBytes);
});

// now configure additional features routes
authApi.register(app);
thumbApi.register(app);
metadataApi.register(app);

// create the server using HTTPS with key and cert files
const server = new webdav.WebDAVServer({
    // HTTP Digest authentication with the realm 'Default realm'
    // httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
    // basic auth only for synology cloud sync
    httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, 'Default realm'),
    requireAuthentification: true,
    privilegeManager: privilegeManager,
    storageManager: quotaManager
});

server.beforeRequest(beforeDELETEListener);

server.afterRequest(afterLogListener);
server.afterRequest(afterPUTListener);

// configure physical path mapping for the root directories of all users.
// the user's root directories are mounted under the user name as root for all directories.
userConfig.users.forEach(user => {

    user.rootDirectories.forEach(rootDir => {
        try {
            fs.statSync(rootDir.physicalPath);

            const rootDirName = rootDir.name.startsWith('/') ? `/${user.username}${rootDir.name}` : `/${user.username}/${rootDir.name}`;

            server.setFileSystem(rootDirName, new webdav.PhysicalFileSystem(rootDir.physicalPath), (success) => {
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
});

// activate webdav server as an expressjs handler
app.use(webdav.extensions.express(process.env.DAV_WEB_CONTEXT, server));

// create HTTPS server only if enabled in the configuration
// see dotenv-sample file for instructions about SSL and HTTPS
if (process.env.SERVER_SSL_ENABLED === 'true') {
    https.createServer({
        key: fs.readFileSync(process.env.SERVER_SSL_KEY_FILE),
        cert: fs.readFileSync(process.env.SERVER_SSL_CERT_FILE)
    }, app).listen(port, () => {
        // tslint:disable-next-line:no-console
        console.log(`Server started at https://localhost:${port}${process.env.DAV_WEB_CONTEXT}`);
    });
} else {
    http.createServer(app).listen(port, () => {
        // tslint:disable-next-line:no-console
        console.log(`Development server started at http://localhost:${port}${process.env.DAV_WEB_CONTEXT}`);
    })
}