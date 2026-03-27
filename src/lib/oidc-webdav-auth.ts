import { HTTPAuthentication } from 'webdav-server/lib/user/v2/authentication/HTTPAuthentication';
import { HTTPRequestContext } from 'webdav-server/lib/server/v2/RequestContext';
import { IUser } from 'webdav-server/lib/user/v2/IUser';
import { SimpleUser } from 'webdav-server/lib/user/v2/simple/SimpleUser';
import { loadUsers } from './auth';
import argon2 from 'argon2';

export class OIDCWebDAVAuthentication implements HTTPAuthentication {
    private realm: string;

    constructor(realm: string = 'WebDAV') {
        this.realm = realm;
    }

    askForAuthentication(): { [headerName: string]: string } {
        return {
            'WWW-Authenticate': `Basic realm="${this.realm}"`
        };
    }

    getUser(ctx: HTTPRequestContext, callback: (error: Error | null, user?: IUser) => void): void {
        // First, check for session-based authentication (OIDC)
        const req = ctx.request as unknown as { session?: { user?: { username: string } } };
        if (req.session && req.session.user) {
            const sessionUser = req.session.user;
            
            // Find user in config to get password (needed for WebDAV user object)
            const configUser = loadUsers().users.find(u => u.username === sessionUser.username);
            if (configUser) {
                const user = new SimpleUser(sessionUser.username, configUser.password, false, false);
                return callback(null, user);
            }
        }

        // Fallback to Basic Authentication
        const authorization = ctx.headers.find('authorization');
        if (!authorization || !authorization.startsWith('Basic ')) {
            return callback(new Error('No authentication provided'));
        }

        try {
            const credentials = Buffer.from(authorization.substring(6), 'base64').toString('utf-8');
            const colonIndex = credentials.indexOf(':');
            if (colonIndex === -1) {
                return callback(new Error('Invalid credentials format'));
            }
            const username = credentials.substring(0, colonIndex);
            const password = credentials.substring(colonIndex + 1);

            if (!username || !password) {
                return callback(new Error('Invalid credentials format'));
            }

            // Find the user by username first, then verify password hash with argon2
            const configUser = loadUsers().users.find(u => u.username === username);
            if (!configUser) {
                return callback(new Error('Invalid credentials'));
            }

            argon2.verify(configUser.password, password).then(isValid => {
                if (isValid) {
                    callback(null, new SimpleUser(username, configUser.password, false, false));
                } else {
                    callback(new Error('Invalid credentials'));
                }
            }).catch(() => {
                callback(new Error('Authentication failed'));
            });
        } catch (error) {
            callback(new Error('Authentication failed'));
        }
    }
}
