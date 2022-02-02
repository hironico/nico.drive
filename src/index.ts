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

// configure users for app
console.log('Creating DAV user : ' + process.env.DAV_USER);

const user = userManager.addUser(process.env.DAV_USER, process.env.DAV_PASSWORD, false);
const adminUser = userManager.addUser(process.env.DAV_ADMIN_USER, process.env.DAV_ADMIN_PASSWORD, true);

// Privilege manager (tells which users can access which files/folders)
const privilegeManager = new webdav.SimplePathPrivilegeManager();

// add privilege manager to locals to retreive it from routes
app.locals.privilegeManager = privilegeManager;

// configure privileges
privilegeManager.setRights(user, process.env.DAV_MAPPED_PATH, ['all']);
privilegeManager.setRights(adminUser, '/', ['all']);

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
    privilegeManager: privilegeManager
});

// display some logs if required by the configuration.
const debugAfterRequest = process.env.LOG_AFTER_REQUEST;
server.afterRequest((arg, next) => {
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
try {
    fs.statSync(process.env.DAV_PHYSICAL_PATH);
} catch (problem) {
    console.log('Check the .env configuration file and ensure that the DAV_PHYSICAL_PATH exists and is readable.');
    process.exit(-79);
}
server.setFileSystem(process.env.DAV_MAPPED_PATH, new webdav.PhysicalFileSystem(localPhysicalPath), (success) => {
    if (success) {
        console.log(`Successfully loaded the physical path:  ${localPhysicalPath} into mapped path as: ${process.env.DAV_MAPPED_PATH}`);
    } else {
        const errMsg = `Cannot map physical path: ${localPhysicalPath} into: ${process.env.DAV_MAPPED_PATH}`
        console.log(errMsg);
        throw new Error(errMsg);
    }
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