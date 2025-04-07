import * as express from "express";
import bodyParser from "body-parser";
import { OptionsJson } from "body-parser";
import { basicAuthHandler, findPhysicalPath } from "../lib/auth";
import expressBasicAuth from "express-basic-auth";
import archiver from "archiver";
import { statSync } from "fs";

export const register = (app: express.Application) : void => {

    // first protect the API using the basic Auth handler
    app.use('/zip', expressBasicAuth({ authorizer: basicAuthHandler }));

    // configure body parser to accept json only for /meta/... request paths
    // in order to let the original dav server configuration untouched
    const jsonOpts: OptionsJson = {
        type: 'application/json'
    }    
    app.use('/zip', bodyParser.json(jsonOpts));

    app.post('/zip', (req, res) => {
        const filename: string = req.body.filename;
        const username: string = req.body.username;
        const homeDir: string = req.body.homeDir;

        if (typeof filename === 'undefined' || filename === null) {
            res.status(403).send('You must provide filename in the request body.').end();
            return;
        }

        if (typeof username === 'undefined' || username === null) {
            res.status(403).send('You must provide username in the request body.').end();
            return;
        }

        if (typeof homeDir === 'undefined' || homeDir === null) {
            res.status(403).send('You must provide homeDir in the request body.').end();
            return;
        }

        const physicalHomeDir = findPhysicalPath(username, homeDir);
        const fullFilename = `${physicalHomeDir}/${filename}`;

        // if not directory -> error
        try {
            const fullStat = statSync(fullFilename);
            if (!fullStat.isDirectory) {
                res.status(400).send('Incorrect directory name. Not a directory.').end();
                return;
            }
        } catch (error) {
            res.status(400).send('Incorrect directoy name. Not found.').end();
        }

        const archive = archiver('zip', {
            zlib: { level: 9 }, // Sets the compression level.
          });
        
          // Listen for all archive data to be written.
          archive.on('end', () => {
            console.log('Archive has been finalized and the output file descriptor has closed.');
            res.end();
          });
        
          // Good practice to catch warnings (ie stat failures and other non-blocking errors)
          archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
              console.warn(err);
            } else {
              throw err;
            }
          });
        
          // Good practice to catch this, especially with large archives
          archive.on('error', (err) => {
            throw err;
          });
        
          // pipe archive data to the response
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}.zip`);
        
          archive.pipe(res);
        
          archive.directory(fullFilename, false);
        
          archive.finalize();
    });
}

