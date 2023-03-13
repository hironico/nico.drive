import { isFileSupported, md5 } from "../lib/fileutils";
import { RequestListener } from "webdav-server/lib/server/v2/webDAVServer/BeforeAfter";
import { findPhysicalPath } from "../lib/auth";
import { unlink, readdir } from "fs/promises";

// AFTER delete listener ensure the thumbs are properly deleted from the cache when a supported
// image file is removed by the webdav server.
export const beforeDELETEListener: RequestListener = (arg, next) => {
    if (arg.request.method === 'DELETE' && arg.response.statusCode === 200 && isFileSupported(arg.requested.uri)) {
        // in nico's drive, the URI is of the form /user/homedirname/relative/path/to/folder/and/file
        const pathElements = arg.requested.uri.split('/');
        pathElements.shift(); // first element is always empty !
        const username = pathElements.shift();
        const homeDirName = `/${pathElements.shift()}`;
        const relativeFileName = pathElements.join('/');
        const homeDirPhysicalPath = findPhysicalPath(username, homeDirName);
        const fullFilename = decodeURIComponent(decodeURI(`${homeDirPhysicalPath}/${relativeFileName}`));
        md5(fullFilename)
        .then(md5Sum => {
            console.log(`>>>> Delete thumb: ${process.env.THUMBS_REPOSITORY_PATH}/${md5Sum}*`);
            readdir(`${process.env.THUMBS_REPOSITORY_PATH}`)
            .then(files => {
               files.filter(name => name.startsWith(md5Sum)).forEach(f =>{
                    unlink(`${process.env.THUMBS_REPOSITORY_PATH}/${f}`)
                    .catch(reason => console.error(`>>>> WARNING: cannot delete thumbs for: ${fullFilename}.\nReason: ${reason}`));
               })
            }).catch(error => console.error(`>>>> WARNING: Cannot delete thumbs for ${fullFilename}.\n${error}`));
        })
        .catch(error => console.error(`>>>> ERROR: cannot compute MD5 for deleting thumbs of ${fullFilename}`));
    }
    
    next();
}