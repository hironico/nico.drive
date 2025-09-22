import { v2 as webdav } from "webdav-server";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import csp from "helmet-csp";
import session from "express-session";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

import * as authApi from "./routes/auth";
import * as thumbApi from "./routes/thumb";
import * as metadataApi from "./routes/metadata";
import * as metricsApi from "./routes/metrics";
import * as zipApi from "./routes/zip";

import { afterPUTListener } from "./requestlistener/afterPUTListener";
import { beforeDELETEListener } from "./requestlistener/beforeDELETEListener";
import { afterLogListener } from "./requestlistener/afterLogListener";
import { PerUserQuotaStorageManager } from "./lib/quota";
import { OIDCWebDAVAuthentication } from "./lib/oidc-webdav-auth";
import { refreshUserConfig } from "./lib/auth";

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
if (process.env.SERVER_SSL_ENABLED === 'true') {
    try {
        fs.statSync(process.env.SERVER_SSL_KEY_FILE);
        fs.statSync(process.env.SERVER_SSL_CERT_FILE);
    } catch (problem) {
        console.log('Check the .env configuration file and ensure the server cert and key files are present and readable.');
        process.exit(-89);
    }
}

const app = express();

app.use(helmet());
app.use(csp({
    directives: {
      defaultSrc: ["'self'"]
    }
  }));

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

// Configure session middleware
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
    cookie: {
        secure: process.env.SERVER_SSL_ENABLED === 'true',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// available from configuration file .env
const port = process.env.SERVER_PORT;

// define a route handler for the client web app aka nico.drive.client
// see hironico GitHub project
const clientDir = path.join(__dirname, '..', process.env.CLIENT_ROOT_DIR);
try {
    fs.accessSync(clientDir, fs.constants.R_OK);
    console.log(`Client web application will be served from: ${clientDir}`);
} catch (error) {
    console.error(`Cannot read from ${clientDir}. Cannot serve embedded client web ui: ${error}`);
    process.exit(-1);
}

// Simple middleware to check authentication for web client
const checkWebAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {

    console.debug(`Checking auth for path: ${req.path}`);

    // Allow access to auth routes
    if (req.path.startsWith('/auth/')) {
        return next();
    }
    
    // Check if user is authenticated via session
    if (req.session && req.session.user) {
        return next();
    }
    
    // Redirect to login if not authenticated
    res.redirect('/auth/login');
};

// Protect the main application with authentication
app.use("/", checkWebAuth, express.static(clientDir));

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

// add quota manager to locals to retreive it from routes
app.locals.quotaManager = quotaManager;

// create the server using OIDC authentication with basic auth fallback
const server = new webdav.WebDAVServer({
    // Use custom OIDC authentication that supports session-based auth and basic auth fallback
    httpAuthentication: new OIDCWebDAVAuthentication('Default realm'),
    requireAuthentification: true,
    privilegeManager: privilegeManager,
    storageManager: quotaManager
});

server.beforeRequest(beforeDELETEListener);

server.afterRequest(afterLogListener);
server.afterRequest(afterPUTListener);

// store a reference to the server in the express app so we can refer to it for user configuration
app.locals.webdav = server;

// now configure additional features routes
authApi.register(app);
thumbApi.register(app);
metadataApi.register(app);
metricsApi.register(app);
zipApi.register(app);

// configure the users, the webdav server root directories and their quota from the config file
refreshUserConfig(app);

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
