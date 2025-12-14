import * as express from "express";
import { IUser } from "webdav-server";
import dotenv from 'dotenv';
import { randomUUID } from "crypto";
import { oidcAuthService, randomState } from '../lib/oidc-auth';
import { addUser, refreshUserConfig, updateUser, loadUsers } from "../lib/auth";
import { IRootDirectory } from "../models/IRootDirectory";
import { UserConfig } from "../models/UserConfig";
import { mkdirSync } from "fs";

// Extend session interface
declare module 'express-session' {
    interface SessionData {
        user?: {
            username: string;
            email?: string;
            name?: string;
            roles?: string[];
            quota?: number;
        };
        oidcState?: string;
        oidcCodeVerifier?: string;
        idToken?: string;
    }
}

// ensure config is loaded
dotenv.config();

export const register = (app: express.Express): void => {
    // Initialize OIDC service
    oidcAuthService.initialize().catch(error => {
        console.error('Failed to initialize OIDC service:', error);
    });

    // Initiate OIDC login
    app.get("/auth/login", async (req, res) => {
        try {
            const state = randomState();
            const { authUrl, codeVerifier } = await oidcAuthService.generateAuthUrl(state);
            
            // Store state and code verifier in session
            req.session.oidcState = state;
            req.session.oidcCodeVerifier = codeVerifier;
            
            res.redirect(authUrl);
        } catch (error) {
            console.error('Error initiating OIDC login:', error);
            res.status(500).json({ error: 'Authentication service unavailable' });
        }
    });

    // Handle OIDC callback
    app.get("/auth/callback", async (req, res) => {
        console.log('=== /auth/callback Request Details ===');
        console.log('Protocol:', req.protocol);
        console.log('Hostname:', req.hostname);
        console.log('Port:', req.get('host'));
        console.log('Original URL:', req.originalUrl);
        console.log('Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.log('X-Forwarded-Proto:', req.get('X-Forwarded-Proto'));
        console.log('X-Forwarded-Host:', req.get('X-Forwarded-Host'));
        console.log('Cookie header:', req.get('Cookie'));
        console.log('Session ID:', req.sessionID);
        console.log('======================================');
        
        try {
            const { code, state } = req.query;
            const sessionState = req.session.oidcState;
            const codeVerifier = req.session.oidcCodeVerifier;

            if (!code || !state || state !== sessionState || !codeVerifier) {
                return res.status(400).json({ error: 'Invalid callback parameters' });
            }

            // IMPORTANT: Use the configured KEYCLOAK_REDIRECT_URI for token exchange
            // This MUST match the redirect_uri used in the authorization request
            // Do NOT use req.protocol/req.get('host') as they may differ due to proxy
            const { user: oidcUser, idToken } = await oidcAuthService.handleCallback(
                code as string,
                state as string,
                codeVerifier
            );

            console.log(`Found oidc user : ${JSON.stringify(oidcUser, null, 4)}`);

            // Check if user exists in users_config.json
            const configUser = loadUsers().users.find(u => u.username === oidcUser.username);
            if (!configUser) {
                console.log(`OIDC user ${oidcUser.username} not found in users_config.json. Now creating it autmatically !`);

                const newUser = new UserConfig();
                newUser.uid = randomUUID();
                newUser.isAdministrator = oidcUser.roles?.includes('nicodrive-admin') ? true : false;
                newUser.isDefaultUser = false;
                newUser.password = randomUUID(); // password is handled by keycloak whatever the login method is. Lets define a random password which will not be used anyway.
                newUser.username = oidcUser.username;                        
                newUser.quota = oidcUser.quota ? oidcUser.quota * 1024 * 1024 * 1024 : 0; // in bytes

                const dataHome = process.env.DAV_DATA_HOME ? `${process.env.DAV_DATA_HOME}/${newUser.uid}` : `/home/${newUser.uid}`;
                const defaultRootDirPhysicalPath = `${dataHome}/cloudy_drive`;
                try {
                    // create first root directory to configure later on
                    const firstPath = mkdirSync(defaultRootDirPhysicalPath, {recursive: true});
                    if (!firstPath) {
                        res.status(500).send(`Unable to create user home directory: ${dataHome}`).end();
                        return;
                    }
                } catch (error) {
                    console.error(`Cannot create new user's home directory: ${error}`);
                    res.status(500).send(error).end();
                    return;
                }

                const rootDirectories = new Array<IRootDirectory>();
                const defaultRootDir: IRootDirectory = {
                    physicalPath: defaultRootDirPhysicalPath,
                    name: "Cloudy Drive",
                    roles: [ 'all', 'canWrite' ]
                }
                rootDirectories.push(defaultRootDir);

                newUser.rootDirectories = rootDirectories;

                // adduser to config file
                addUser(newUser);                
            } else {
                // update user information if any change in keycloak
                const updateUserData = {
                    isAdministrator: oidcUser.roles?.includes('nicodrive-admin') ? true : false,
                    quota: oidcUser.quota
                }
                updateUser(configUser.username, updateUserData);
            }

            // setup DAV server with updated config file and compute space used
            refreshUserConfig(app);

            // Store user and ID token in session
            req.session.user = {
                username: oidcUser.username,
                email: oidcUser.email,
                name: oidcUser.name,
                roles: oidcUser.roles,
                quota: oidcUser.quota ? oidcUser.quota * 1024 * 1024 * 1024 : 0, // in bytes
            };
            req.session.idToken = idToken;

            // Clear OIDC temporary data
            delete req.session.oidcState;
            delete req.session.oidcCodeVerifier;

            console.log(`OIDC authentication successful for user: ${oidcUser.username}`);
            console.log('Session BEFORE save:', JSON.stringify(req.session, null, 2));
            console.log('Session ID BEFORE save:', req.sessionID);
            
            // Save session before redirecting to ensure session data is persisted
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err);
                    return res.status(500).json({ error: 'Failed to save session' });
                }
                console.log('Session AFTER save callback:', JSON.stringify(req.session, null, 2));
                console.log('Session ID AFTER save:', req.sessionID);
                console.log('Session saved successfully, redirecting to /');
                res.redirect('/');
            });
        } catch (error) {
            console.error('Error handling OIDC callback:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    });

    // Logout endpoint
    app.get("/auth/logout", async (req, res) => {
        try {
            const idToken = req.session.idToken;
            
            // Clear session
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
            });

            // Redirect to Keycloak logout
            const logoutUrl = oidcAuthService.generateLogoutUrl(idToken);
            res.redirect(logoutUrl);
        } catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/');
        }
    });

    // Check authentication status and download profile
    app.get("/auth/status", (req, res) => {
        console.log('=== /auth/status Request Details ===');
        console.log('Protocol:', req.protocol);
        console.log('Hostname:', req.hostname);
        console.log('Port:', req.get('host'));
        console.log('Original URL:', req.originalUrl);
        console.log('Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.log('X-Forwarded-Proto:', req.get('X-Forwarded-Proto'));
        console.log('X-Forwarded-Host:', req.get('X-Forwarded-Host'));
        console.log('Cookie header:', req.get('Cookie'));
        console.log('Session ID:', req.sessionID);
        console.log('Session data:', JSON.stringify(req.session, null, 2));
        console.log('====================================');
        
        if (req.session && req.session.user) {
            console.log(`Found authenticated user: ${JSON.stringify(req.session.user)}`);

            // ok found a user, now let's get its profile for nico drive with used quota
            app.locals.userManager.getUserByName(req.session.user.username, (error: Error, user: IUser) => {
                if (user) {                    
                    // Complete with quota info from quota manager
                    const quotaUsed = app.locals.quotaManager.getUserReserved(user);

                    console.log(`Quota used for ${req.session.user.username} = ${quotaUsed} bytes.`);

                    // complete with user root directories
                    const allUsers = loadUsers().users;
                    const cfgUser = allUsers.filter(u => u.username === req.session.user.username)[0];
                    const rootDirs = cfgUser.rootDirectories.map(dir => dir.name);

                    // Find directories shared with this user (specific shares + public directories)
                    const sharedDirs: Array<{name: string, owner: string, access: string}> = [];
                    allUsers.forEach(otherUser => {
                        if (otherUser.uid !== cfgUser.uid) {
                            otherUser.rootDirectories.forEach(dir => {
                                // Check for specific shares
                                if (dir.shares) {
                                    dir.shares.forEach(share => {
                                        if (share.uid === cfgUser.uid) {
                                            sharedDirs.push({
                                                name: dir.name,
                                                owner: otherUser.username,
                                                access: share.access
                                            });
                                        }
                                    });
                                }
                                // Check for public directories (read-only)
                                if (dir.isPublic === true) {
                                    // Only add if not already added through specific share
                                    const alreadyShared = dir.shares?.some(s => s.uid === cfgUser.uid);
                                    if (!alreadyShared) {
                                        sharedDirs.push({
                                            name: dir.name,
                                            owner: otherUser.username,
                                            access: 'canRead'
                                        });
                                    }
                                }
                            });
                        }
                    });

                    res.json({
                        authenticated: true,
                        user: req.session.user,
                        quotaUsed: quotaUsed,
                        rootDirectories: rootDirs,
                        sharedDirectories: sharedDirs,
                        isAdministrator: user.isAdministrator
                    });
                }
            });
        } else {
            console.log('User is NOT authenticated.');
            res.json({
                authenticated: false
            });
        }
    });

    // redirect to profile page in keycloak using the issuer URL parameter from .env file
    app.get('/auth/profile', (req, res) => {
        console.log('Now redirecting to account profile page...');
        res.redirect(`${process.env.KEYCLOAK_ISSUER_URL}/account`);
    });
};
