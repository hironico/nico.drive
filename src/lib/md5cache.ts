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
 * @returns Promise<string> MD5 checksum as hex string
 */
export const getMd5WithCache = (server: webdav.WebDAVServer, ctx: webdav.RequestContext, resourcePath: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const path = new webdav.Path(resourcePath);
        
        server.getFileSystem(path, (fs, _, subPath) => {
            if (!fs) {
                reject(`Filesystem not found for path: ${resourcePath}`);
                return;
            }

            fs.propertyManager(ctx, subPath, (error, propertyManager) => {
                if (error) {
                    console.warn(`Could not get property manager for ${resourcePath}: ${error}`);
                    // Fall back to calculating MD5 without caching
                    calculateMd5(resourcePath)
                        .then(md5Sum => resolve(md5Sum))
                        .catch(err => reject(err));
                    return;
                }

                // Try to get cached MD5
                propertyManager.getProperty(MD5_PROPERTY_NAME, (err, value) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                    if (!err && value && typeof value === 'string' && value.length === 32) {
                        console.log(`Using cached MD5 for: ${resourcePath} => ${value}`);
                        resolve(value);
                    } else {
                        // Not cached, calculate and store
                        console.log(`No cached MD5 found for: ${resourcePath}, calculating...`);
                        calculateAndStoreMd5(server, ctx, resourcePath)
                            .then(md5Sum => resolve(md5Sum))
                            .catch(err => reject(err));
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
 * @param resourcePath Path to the resource
 * @returns Promise<string> MD5 checksum as hex string
 */
export const calculateAndStoreMd5 = (server: webdav.WebDAVServer, ctx: webdav.RequestContext, resourcePath: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        // Calculate MD5 first
        calculateMd5(resourcePath)
            .then(md5Sum => {
                // Store it in WebDAV properties
                const path = new webdav.Path(resourcePath);
                
                server.getFileSystem(path, (fs, _, subPath) => {
                    if (!fs) {
                        console.warn(`Filesystem not found for ${resourcePath}, MD5 calculated but not cached`);
                        resolve(md5Sum);
                        return;
                    }

                    fs.propertyManager(ctx, subPath, (error, propertyManager) => {
                        if (error) {
                            console.warn(`Could not get property manager to store MD5 for ${resourcePath}: ${error}`);
                            resolve(md5Sum);
                            return;
                        }

                        propertyManager.setProperty(MD5_PROPERTY_NAME, md5Sum, {}, (err) => {
                            if (err) {
                                console.warn(`Could not store MD5 property for ${resourcePath}: ${err}`);
                            } else {
                                console.log(`MD5 calculated and cached for: ${resourcePath} => ${md5Sum}`);
                            }
                            resolve(md5Sum);
                        });
                    });
                });
            })
            .catch(error => {
                console.error(`Error calculating MD5 for ${resourcePath}:`, error);
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
