import * as express from "express";
import bodyParser from "body-parser";
import { OptionsJson } from "body-parser";
import { findPhysicalPath } from "../lib/auth";
import XMPLoader from "../lib/xmp";
import { dirSize, getFileExtention } from "../lib/fileutils";
import { dirElementsCount } from "../lib/fileutils";
import { accessSync, constants, existsSync, statSync } from "fs";
import exifr from "exifr";

const isExifSupported = (extension: string): boolean => {
    switch(extension) {
        case 'JPEG':
        case 'JPG':
        case 'HEIC':
            return true;

        default:
            return false;
    }
}

export const register = (app: express.Application) : void => {
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
        const ext = getFileExtention(fullFilename);        
        if (isExifSupported(ext)) {
            exifr.parse(fullFilename, {xmp: true})
            .then(exifData => {
                console.log('EXIT DATA IS\n' + JSON.stringify(exifData, null, 4));
                res.status(200).json(exifData);
            }).catch(error => {
                console.log('Error while retreiving exif data: ' + error.message);
                res.status(500).send(error).end();
            })
        } else {
            res.status(415).send('Not supported file type for reading exif data.').end();
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

        if (filename.toLowerCase().endsWith('.jpg')) {
            console.log(`Loading XMP info from file: ${fullFilename}...`);
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
                    console.log(`XMP parsed data is:\n${JSON.stringify(parsedData, null, 4)}`);
                    res.status(200).json(parsedData);
                })
                .catch(error => {
                    console.log(`Problem while parsing XMP data: ${error}`);
                    res.status(404).send(JSON.stringify(error)).end();
                });
        } else {
            res.status(200).send('').end();
        }
    });

    app.post('/meta/folder', (req, res) => {

        const filename: string = req.body.filename;
        const username: string = req.body.username;
        const homeDir: string = req.body.homeDir;

        if (typeof filename === 'undefined' || filename === null) {
            res.status(400).send('You must provide filename in the request body.').end();
            return;
        }

        if (typeof username === 'undefined' || username === null) {
            res.status(400).send('You must provide username in the request body.').end();
            return;
        }

        if (typeof homeDir === 'undefined' || homeDir === null) {
            res.status(400).send('You must provide homeDir in the request body.').end();
            return;
        }

        const physicalHomeDir = findPhysicalPath(username, homeDir);
        const fullDirName = `${physicalHomeDir}/${filename}`;

        if (!existsSync(fullDirName)) {
            res.status(400).send(`Provided filename not found. ${filename}`).end();
            return;
        }

        const dirInfo = statSync(fullDirName);
        if (!dirInfo || !dirInfo.isDirectory()) {
            res.status(400).send('Provided filename is not a directory.').end();
            return;
        }

        try {
            accessSync(fullDirName, constants.R_OK | constants.X_OK);
        } catch (error) {
            res.status(400).send('Cannot read this directory. Permission denied.').end();
            return;
        }

        const sizeInBytes = dirSize(fullDirName);
        const elementsCount = dirElementsCount(fullDirName);

        const dirMetatData = {
            sizeBytes: sizeInBytes,
            elementsCount: elementsCount
        }

        res.status(200).send(JSON.stringify(dirMetatData));
    });
}