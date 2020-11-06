import { v2 as webdav } from 'webdav-server';
import express from "express";

const app = express();
const port = 8080; // default port to listen

// define a route handler for the default home page
app.get( "/", ( req, res ) => {
    res.send( "This is nico.drive web user interface. Come back later to see how great this interface performs when it is finished!" );
} );

// User manager (tells who are the users)
const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser('hironico', 'hironico', true);

// Privilege manager (tells which users can access which files/folders)
const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, '/', [ 'all' ]);

const server = new webdav.WebDAVServer({
    // HTTP Digest authentication with the realm 'Default realm'
    // httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
    httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, 'Default realm'),
    privilegeManager: privilegeManager
});

// activate some logs
server.afterRequest((arg, next) => {
    // Display the method, the URI, the returned status code and the returned message
    console.log('>>', arg.request.method, arg.requested.uri, '>', arg.response.statusCode, arg.response.statusMessage);
    // If available, display the body of the response
    console.log(arg.responseBody ? arg.responseBody : 'no response body');
    next();
});

const localPhysicalPath = '/mnt/c/Users/nramo/source/nico.drive/data/';
server.setFileSystem('/nico', new webdav.PhysicalFileSystem(localPhysicalPath), (success) => {
    if (success) {
        console.log('Successfully loaded the physcal path : ' + localPhysicalPath);        
    } else {
        console.log('ERROR: could not load the physical path: ' + localPhysicalPath);
    }    
});

// activate webdav server with the specified path to store files.
app.use(webdav.extensions.express('/dav', server));

// start the Express server
app.listen( port, () => {
    // tslint:disable-next-line:no-console
    console.log( `server started at http://localhost:${ port }` );
} );