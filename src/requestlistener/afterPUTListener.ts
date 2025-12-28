import { findPhysicalPath } from "../lib/auth";
import { RequestListener } from "webdav-server/lib/server/v2/webDAVServer/BeforeAfter";
import { isFileSupported } from "../lib/fileutils";
import { generateAndSaveThumb } from "../lib/imageutils";
import { calculateAndStoreMd5 } from "../lib/md5cache";

// AFTER the webdav server did its job then we would like to generqte thumbs for supported images.
// That way, the thumb api will not have to regenerate it on the fly.
// the only problem we had is that we do not know about the exact url because it depends of the file
// being accessed. So we use this afterRequest callback from the webdav server.
export const afterPUTListener: RequestListener = (arg, next) => {
    
    if (arg.request.method === 'PUT' && arg.response.statusCode >= 200 && arg.response.statusCode < 300) {
        // in nico's drive, the URI is of the form /user/homedirname/relative/path/to/folder/and/file
        const pathElements = arg.requested.uri.split('/');
        pathElements.shift(); // first element is always empty !
        const username = pathElements.shift();
        const homeDirName = `/${pathElements.shift()}`;
        const relativeFileName = pathElements.join('/');
        const homeDirPhysicalPath = findPhysicalPath(username, homeDirName);
        const fullFilename = decodeURIComponent(decodeURI(`${homeDirPhysicalPath}/${relativeFileName}`));
        const resizeFit = 'cover';
        
        // Calculate and store MD5 as WebDAV property for future use
        calculateAndStoreMd5(arg.server, arg, fullFilename)
            .then(md5Sum => {
                console.log(`MD5 stored for uploaded file: ${fullFilename} => ${md5Sum}`);
            })
            .catch(error => {
                console.warn(`Could not store MD5 for ${fullFilename}: ${error}`);
            });
        
        if (isFileSupported(fullFilename)) {
            generateAndSaveThumb(fullFilename, 200, 200, resizeFit)
            .then(_outputFileName => {// eslint-disable-line @typescript-eslint/no-unused-vars
                try {
                    generateAndSaveThumb(fullFilename, 60, 60, resizeFit); 
                } catch (error) {
                    console.error(`Error while generating ${fullFilename} thumb. ${error}`);
                }
            })
            .catch(error => {
                if (typeof error !== 'undefined' && 'LOCKED' !== error.name) {
                    console.warn(`>>>>>> WARNING: Cannot generate thumb for ${fullFilename}.\n${JSON.stringify(error)}`);
                }
            });
        } 
    }

    next();
}
