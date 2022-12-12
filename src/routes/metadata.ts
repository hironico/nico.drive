import * as express from "express";
import bodyParser from "body-parser";
import { OptionsJson } from "body-parser";
import { ExifImage, ExifData } from "exif";
import { basicAuthHandler, findPhysicalPath } from "../lib/auth";
import XMPLoader from "../lib/xmp";
import expressBasicAuth from "express-basic-auth";

export const register = (app: express.Application) : void => {

    // first protect the API using the basic Auth handler
    app.use('/meta', expressBasicAuth({ authorizer: basicAuthHandler }));

    // configure body parser to accept json only for /meta/... request paths
    // in order to let the original dav server configuration untouched
    const jsonOpts: OptionsJson = {
        type: 'application/json'
    }    
    app.use('/meta', bodyParser.json(jsonOpts));

    app.post('/meta/exif', (req, res) => {
        const filename: string = req.body.filename;
        const username: string = req.body.username;
        const homeDir: string = req.body.homeDir;

        if (typeof filename === 'undefined' || filename === null) {
            res.status(403).send('You must provide filename in the request body to get exif data if any.').end();
            return;
        }

        if (typeof username === 'undefined' || username === null) {
            res.status(403).send('You must provide username in the request body to get exif data if any.').end();
            return;
        }

        if (typeof homeDir === 'undefined' || homeDir === null) {
            res.status(403).send('You must provide homeDir in the request body to get exif data if any.').end();
            return;
        }

        const physicalHomeDir = findPhysicalPath(username, homeDir);
        const fullFilename = `${physicalHomeDir}/${filename}`;

        if (filename.toLowerCase().endsWith('.jpg')) {
            // load exif data if any in this jpg file.
            try {
                new ExifImage(fullFilename, (error: Error, exifData: ExifData) => {
                    if (error) {
                        console.log('Cannot get the Exif data: ' + error.message);
                        res.status(500).send(error.message).end();
                    } else {
                        console.log(exifData); 
                        res.status(200).send(exifData);
                    }
                });
            } catch (error) {
                console.log('Error while retreiving exif data: ' + error.message);
                res.status(500).send(error).end();
            }
        } else {
            res.status(415).send('Not supported file nature for exif extract.').end();
        }
    });

    app.post('/meta/xmp', (req, res) => {
        const filename: string = req.body.filename;
        const username: string = req.body.username;
        const homeDir: string = req.body.homeDir;

        if (typeof filename === 'undefined' || filename === null) {
            console.log(`Cannot get XMP meta data. File not found: ${filename}`)
            res.status(403).send('You must provide filename in the request body to get exif data if any.').end();
            return;
        }

        if (typeof username === 'undefined' || username === null) {
            res.status(403).send('You must provide username in the request body to get exif data if any.').end();
            return;
        }

        if (typeof homeDir === 'undefined' || homeDir === null) {
            res.status(403).send('You must provide homeDir in the request body to get exif data if any.').end();
            return;
        }

        const physicalHomeDir = findPhysicalPath(username, homeDir);
        const fullFilename = `${physicalHomeDir}/${filename}`;

        console.log(`Loading XMP info from file: ${fullFilename}...`);

        if (filename.toLowerCase().endsWith('.jpg')) {
            const loader: XMPLoader = new XMPLoader(fullFilename);
            const xmp: string = loader.find();

            res.set({
                'Content-Type': 'application/json',
                'cache-control': 'max-age=0'
            });

            if (!xmp) {
                const message = [{
                    type: 'info',
                    data: `No XMP information found in this file: ${filename}`
                }]
                res.status(404).send(message).end();
                return;
            }

            const promise = loader.parse(xmp, false);
            if (promise === null) {
                const message = {
                    type: 'info',
                    data: `No XMP information found in this file: ${filename}`
                };
                res.status(404).send(message).end();
                return;
            }

            promise.then(parsedData => {
                    console.log(`XMP parsed data is:\n${parsedData}`);
                    res.status(200).send(JSON.stringify(parsedData));
                })
                .catch(error => {
                    console.log(`Problem while parsing XMP data: ${error}`);
                    res.status(404).send(JSON.stringify(error)).end();
                });
        } else {
            res.status(200).send('').end();
        }
    });
}