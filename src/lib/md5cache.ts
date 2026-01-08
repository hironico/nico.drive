/**
 * MD5 Cache utility using WebDAV PropertyManager
 * This module provides functions to store and retrieve MD5 checksums
 * as WebDAV properties to avoid recalculating them on every access.
 */

import { v2 as webdav } from "webdav-server";
import { md5 as calculateMd5 } from './fileutils';

// WebDAV property name for storing MD5
const MD5_PROPERTY_NAME = 'md5';

/**
 * Get MD5 from WebDAV properties if available, otherwise calculate and store it
 * @param server The WebDAV server instance
 * @param ctx Request context
 * @param resourcePath Path to the resource
 * @param fullFilename path to the physical filename corresponding to the resrouce
 * @returns Promise<string> MD5 checksum as hex string
 */
export const getMd5WithCache = (server: webdav.WebDAVServer, resourcePath: string, fullFilename: string, username: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const fullResourceName = `/${username}${resourcePath}`;        
        const path = new webdav.Path(fullResourceName);
        
        console.log(`Found path for resource. ${JSON.stringify(path)}`);

        server.getFileSystem(path, (fs, _rootPath, subPath) => {
            if (!fs) {
                reject(`Filesystem not found for path: ${resourcePath}`);
                return;
            }

            const ctx = webdav.ExternalRequestContext.create(server);
            ctx.user = {
                uid: username,
                username: username
            };
            ctx.overridePrivileges = true;

            fs.propertyManager(ctx, subPath, (error, propertyManager) => {
                if (error) {
                    console.warn(`Could not get property manager for ${resourcePath}: ${error}`);
                    // Fall back to calculating MD5 without caching
                    calculateMd5(fullFilename)
                        .then(md5Sum => resolve(md5Sum))
                        .catch(err => reject(err));
                    return;
                }

                propertyManager.getProperties((error, props) => {
                    if (error) {
                        // Not cached, calculate and store
                        console.error(`Error Getting resoource properties, for: ${resourcePath}, calculating for physical filename: ${fullFilename}...`);
                        calculateAndStoreMd5(server, ctx, path, fullFilename)
                            .then(md5Sum => resolve(md5Sum))
                            .catch(err => reject(err)); 
                    } else {
                        if (props[MD5_PROPERTY_NAME]) {
                            const value = props[MD5_PROPERTY_NAME].value as string;
                            console.debug(`Using cached MD5 for: ${resourcePath} => ${value}`);
                            resolve(value);
                        } else {
                            console.debug(`No cached property found for: ${resourcePath}, calculating for physical filename: ${fullFilename}...`);
                            calculateAndStoreMd5(server, ctx, path, fullFilename)
                                .then(md5Sum => resolve(md5Sum))
                                .catch(err => reject(err)); 
                        }
                    }
                });
            });
        });
    });
};

/**
 * Calculate MD5 checksum and store it as a WebDAV property
 * @param server The WebDAV server instance
 * @param ctx Request context
 * @param webdavPath WebDAV Path object (already resolved by server)
 * @param physicalPath Physical file path (for MD5 calculation)
 * @returns Promise<string> MD5 checksum as hex string
 */
export const calculateAndStoreMd5 = (server: webdav.WebDAVServer, ctx: webdav.RequestContext, webdavPath: webdav.Path, physicalPath: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        // Calculate MD5 first from physical path
        calculateMd5(physicalPath)
            .then(md5Sum => {
                // Store it in WebDAV properties using the resolved WebDAV path
                server.getFileSystem(webdavPath, (fs, _, subPath) => {
                    if (!fs) {
                        console.warn(`Filesystem not found for ${webdavPath.toString()}, MD5 calculated but not cached`);
                        resolve(md5Sum);
                        return;
                    }

                    fs.propertyManager(ctx, subPath, (error, propertyManager) => {
                        if (error) {
                            console.warn(`Could not get property manager to store MD5 for ${webdavPath.toString()}: ${error}`);
                            resolve(md5Sum);
                            return;
                        }

                        propertyManager.setProperty(MD5_PROPERTY_NAME, md5Sum, {}, (err) => {
                            if (err) {
                                console.warn(`Could not store MD5 property for ${webdavPath.toString()}: ${err}`);
                            } else {
                                console.log(`MD5 calculated and cached for: ${webdavPath.toString()} => ${md5Sum}`);
                            }
                            resolve(md5Sum);
                        });
                    });
                });
            })
            .catch(error => {
                console.error(`Error calculating MD5 for ${physicalPath}:`, error);
                reject(error);
            });
    });
};

/**
 * Get cached MD5 from WebDAV properties without calculating if not present
 * @param server The WebDAV server instance
 * @param ctx Request context
 * @param resourcePath Path to the resource
 * @returns Promise<string | null> MD5 checksum as hex string or null if not cached
 */
export const getCachedMd5 = (server: webdav.WebDAVServer, ctx: webdav.RequestContext, resourcePath: string): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
        const path = new webdav.Path(resourcePath);
        
        server.getFileSystem(path, (fs, _, subPath) => {
            if (!fs) {
                resolve(null);
                return;
            }

            fs.propertyManager(ctx, subPath, (error, propertyManager) => {
                if (error) {
                    resolve(null);
                    return;
                }

                propertyManager.getProperty(MD5_PROPERTY_NAME, (err, value) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                    if (!err && value && typeof value === 'string' && value.length === 32) {
                        resolve(value);
                    } else {
                        resolve(null);
                    }
                });
            });
        });
    });
};
