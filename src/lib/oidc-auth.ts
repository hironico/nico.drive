import * as client from 'openid-client';
import dotenv from 'dotenv';

dotenv.config();

export interface OIDCUser {
    username: string;
    email?: string;
    name?: string;
    roles?: string[];
    quota?: number;
}

interface KeycloakUserInfo {
    preferred_username?: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    sub?: string;
    quota?: number | string; // Custom attribute from Keycloak user profile
    realm_access?: {
        roles?: string[];
    };
    resource_access?: {
        [clientId: string]: {
            roles?: string[];
        };
    };
    // Support for any additional custom attributes
    [key: string]: unknown;
}

export class OIDCAuthService {
    private config: client.Configuration | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            console.log('Initializing OIDC client...');
            
            // Discover the issuer and create configuration
            this.config = await client.discovery(
                new URL(process.env.KEYCLOAK_ISSUER_URL!),
                process.env.KEYCLOAK_CLIENT_ID!,
                process.env.KEYCLOAK_CLIENT_SECRET!
            );

            this.initialized = true;
            console.log('OIDC client initialized successfully');
        } catch (error) {
            console.error('Failed to initialize OIDC client:', error);
            throw error;
        }
    }

    async generateAuthUrl(state: string): Promise<{ authUrl: string, codeVerifier: string }> {
        if (!this.config) {
            throw new Error('OIDC client not initialized');
        }

        const codeVerifier = client.randomPKCECodeVerifier();
        const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
        
        const authUrl = client.buildAuthorizationUrl(this.config, {
            scope: 'openid profile email',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state: state,
            redirect_uri: process.env.KEYCLOAK_REDIRECT_URI!,
        });

        return { authUrl: authUrl.toString(), codeVerifier };
    }

    async handleCallback(code: string, state: string, codeVerifier: string, callbackUrl?: string, retryCount: number = 0): Promise<{ user: OIDCUser, idToken: string }> {
        if (!this.config) {
            throw new Error('OIDC client not initialized');
        }

        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        try {
            // Use the provided callback URL or construct it
            let currentUrl: URL;
            if (callbackUrl) {
                currentUrl = new URL(callbackUrl);
            } else {
                currentUrl = new URL(process.env.KEYCLOAK_REDIRECT_URI!);
                currentUrl.searchParams.set('code', code);
                currentUrl.searchParams.set('state', state);
            }

            console.log(`Authorization code grant with URL: ${currentUrl.toString()}`);

            // Add clock tolerance and proper validation options
            const tokenResponse = await client.authorizationCodeGrant(
                this.config,
                currentUrl,
                {
                    expectedState: state,
                    pkceCodeVerifier: codeVerifier,
                },
                {
                    clockTolerance: '120s', // Increased clock tolerance to 120 seconds
                }
            );

            console.log('Token response received successfully');

            const userinfo = await client.fetchUserInfo(
                this.config,
                tokenResponse.access_token,
                client.skipSubjectCheck
            );

            console.log(`User info received successfully: ${JSON.stringify(userinfo, null, 4)}`)
            
            const user = this.mapUserInfo(userinfo);
            const idToken = tokenResponse.id_token || '';
            
            return { user, idToken };
        } catch (error: unknown) {
            console.error('Error handling OIDC callback:', error);
            console.error('Error details:', error);

            // Check if this is a JWT timestamp validation error
            const errorWithCode = error as { code?: string; message?: string };
            if (errorWithCode.code === 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED' && retryCount < maxRetries) {
                console.warn(`JWT timestamp validation failed (attempt ${retryCount + 1}/${maxRetries + 1}). Retrying after ${retryDelay}ms...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                // Retry with exponential backoff
                return this.handleCallback(code, state, codeVerifier, callbackUrl, retryCount + 1);
            }

            // If it's a JWT timestamp error and we've exhausted retries, try to reinitialize the OIDC client
            if (errorWithCode.code === 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED' && retryCount >= maxRetries) {
                console.warn('JWT timestamp validation failed after all retries. Attempting to reinitialize OIDC client...');
                
                try {
                    // Reset initialization flag and reinitialize
                    this.initialized = false;
                    this.config = null;
                    await this.initialize();
                    
                    console.log('OIDC client reinitialized successfully. Attempting final retry...');
                    
                    // One final attempt with the reinitialized client
                    return this.handleCallback(code, state, codeVerifier, callbackUrl, maxRetries + 1);
                } catch (reinitError) {
                    console.error('Failed to reinitialize OIDC client:', reinitError);
                    throw new Error(`Authentication failed after ${maxRetries} retries and client reinitialization. Original error: ${errorWithCode.message || 'Unknown error'}`);
                }
            }

            throw error;
        }
    }

    async refreshToken(refreshToken: string, retryCount: number = 0): Promise<client.TokenEndpointResponse> {
        if (!this.config) {
            throw new Error('OIDC client not initialized');
        }

        const maxRetries = 2;
        const retryDelay = 1000; // 1 second

        try {
            return await client.refreshTokenGrant(this.config, refreshToken, {
                clockTolerance: '120s', // Increased clock tolerance to 120 seconds
            });
        } catch (error: unknown) {
            console.error('Error refreshing token:', error);

            // Check if this is a JWT timestamp validation error
            const errorWithCode = error as { code?: string; message?: string };
            if (errorWithCode.code === 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED' && retryCount < maxRetries) {
                console.warn(`JWT timestamp validation failed during token refresh (attempt ${retryCount + 1}/${maxRetries + 1}). Retrying after ${retryDelay}ms...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                // Retry with exponential backoff
                return this.refreshToken(refreshToken, retryCount + 1);
            }

            // If it's a JWT timestamp error and we've exhausted retries, try to reinitialize the OIDC client
            if (errorWithCode.code === 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED' && retryCount >= maxRetries) {
                console.warn('JWT timestamp validation failed during token refresh after all retries. Attempting to reinitialize OIDC client...');
                
                try {
                    // Reset initialization flag and reinitialize
                    this.initialized = false;
                    this.config = null;
                    await this.initialize();
                    
                    console.log('OIDC client reinitialized successfully for token refresh. Attempting final retry...');
                    
                    // One final attempt with the reinitialized client
                    return this.refreshToken(refreshToken, maxRetries + 1);
                } catch (reinitError) {
                    console.error('Failed to reinitialize OIDC client during token refresh:', reinitError);
                    throw new Error(`Token refresh failed after ${maxRetries} retries and client reinitialization. Original error: ${errorWithCode.message || 'Unknown error'}`);
                }
            }

            throw error;
        }
    }

    generateLogoutUrl(idToken?: string): string {
        if (!this.config) {
            throw new Error('OIDC client not initialized');
        }

        const serverMetadata = this.config.serverMetadata();
        
        if (!serverMetadata.end_session_endpoint) {
            throw new Error('End session endpoint not configured');
        }

        const logoutUrl = new URL(serverMetadata.end_session_endpoint);
        
        if (idToken) {
            logoutUrl.searchParams.set('id_token_hint', idToken);
        }
        
        logoutUrl.searchParams.set('post_logout_redirect_uri', `${process.env.KEYCLOAK_REDIRECT_URI!.replace('/auth/callback', '')}/`);

        return logoutUrl.toString();
    }

    private mapUserInfo(userinfo: Record<string, unknown>): OIDCUser {
        const typedUserInfo = userinfo as KeycloakUserInfo;
        
        const user: OIDCUser = {
            username: typedUserInfo.preferred_username || typedUserInfo.email || typedUserInfo.sub || 'unknown',
            email: typedUserInfo.email,
            name: typedUserInfo.name || (typedUserInfo.given_name && typedUserInfo.family_name ? `${typedUserInfo.given_name} ${typedUserInfo.family_name}` : undefined),
        };

        // Extract roles from Keycloak claims
        if (typedUserInfo.realm_access?.roles) {
            user.roles = typedUserInfo.realm_access.roles;
        } else if (typedUserInfo.resource_access && process.env.KEYCLOAK_CLIENT_ID) {
            const clientAccess = typedUserInfo.resource_access[process.env.KEYCLOAK_CLIENT_ID];
            if (clientAccess?.roles) {
                user.roles = clientAccess.roles;
            }
        }

        // Extract quota from Keycloak user profile attributes
        if (typedUserInfo.quota !== undefined) {
            // Handle quota as either number or string
            if (typeof typedUserInfo.quota === 'number') {
                user.quota = typedUserInfo.quota;
            } else if (typeof typedUserInfo.quota === 'string') {
                const parsedQuota = parseInt(typedUserInfo.quota, 10);
                if (!isNaN(parsedQuota)) {
                    user.quota = parsedQuota;
                }
            }
        }

        return user;
    }
}

// Singleton instance
export const oidcAuthService = new OIDCAuthService();

// Re-export some utilities for use in other modules
export const randomState = client.randomState;
export const randomNonce = client.randomNonce;
