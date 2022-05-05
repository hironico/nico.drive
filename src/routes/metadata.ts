import * as express from "express";
import bodyParser from "body-parser";
import { OptionsJson } from "body-parser";
import {ExifImage, ExifData} from "exif";
import findPhysicalPath from "../lib/auth";
import XMPLoader from "../lib/xmp";

export const register = (app: express.Application) : void => {

    // configure body parser to accept json only for /meta/... request paths
    // in order to let the original dav server configuration untouched
    const jsonOpts: OptionsJson = {
        type: 'application/json'
    }    
    app.use('/meta', bodyParser.json(jsonOpts));

    app.post('/meta/exif', (req, res) => {
        const filename: string = req.body.filename;

        if (typeof filename === 'undefined' || filename === null) {
            res.status(403).send('You must provide filename in the request body to get exif data if any.').end();
            return;
        }

        const physicalHomeDir = findPhysicalPath(req.body.username, req.body.homeDir);
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
            res.status(415).send('Not surpported file nature for exif extract.').end();
        }
    });

    app.post('/meta/xmp', (req, res) => {
        const filename: string = req.body.filename;
        const rawResult: boolean = req.body.rawResult;

        if (typeof filename === 'undefined' || filename === null) {
            console.log(`Cannot get XMP meta data. File not found: ${filename}`)
            res.status(403).send('You must provide filename in the request body to get exif data if any.').end();
            return;
        }

        const physicalHomeDir = findPhysicalPath(req.body.username, req.body.homeDir);
        const fullFilename = `${physicalHomeDir}/${filename}`;

        console.log(`Loading XMP info from file: ${fullFilename}...`);

        res.set({
            'Content-Type': 'application/json',
            'cache-control': 'max-age=0'
        });

        if (filename.toLowerCase().endsWith('.jpg')) {
            const loader: XMPLoader = new XMPLoader(fullFilename);
            const xmp: string = loader.find();

            if (!xmp) {
                res.status(404).send('No XMP information found in this file: ' + filename).end();
                return;
            }

            const promise = loader.parse(xmp, rawResult);
            if (promise === null) {
                res.status(404).send('No XMP information found in this file: ' + filename).end();
                return;
            }

            promise.then(parsedData => {
                    res.status(200).send(JSON.stringify(parsedData));
                })
                .catch(error => {
                    res.status(404).send(JSON.stringify(error)).end();
                });
        }
    });
}