import { isFileSupported } from "../lib/fileutils";
import { RequestListener } from "webdav-server/lib/server/v2/webDAVServer/BeforeAfter";
import { findPhysicalPath } from "../lib/auth";

// AFTER delete listener ensure the thumbs are properly deleted from the cache when a supported
// image file is removed by the webdav server.
export const afterDELETEListener: RequestListener = (arg, next) => {
    if (arg.request.method === 'DELETE' && arg.response.statusCode === 200 && isFileSupported(arg.requested.uri)) {
        // in nico's drive, the URI is of the form /user/homedirname/relative/path/to/folder/and/file
        const pathElements = arg.requested.uri.split('/');
        pathElements.shift(); // first element is always empty !
        const username = pathElements.shift();
        const homeDirName = `/${pathElements.shift()}`;
        const relativeFileName = pathElements.join('/');
        const homeDirPhysicalPath = findPhysicalPath(username, homeDirName);
        const fullFilename = decodeURIComponent(decodeURI(`${homeDirPhysicalPath}/${relativeFileName}`));
        console.log(`>>>> Should now DELETE thumb for ${fullFilename}`);
    }
    
    next();
}