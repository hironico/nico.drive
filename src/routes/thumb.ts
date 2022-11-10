import * as express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import child_process, { SpawnSyncOptions } from 'child_process';

import sharp from "sharp";
import findPhysicalPath from "../lib/auth";

// supported formats are : JPEG, PNG, WebP, AVIF, TIFF, GIF and SVG
// see doc at : https://sharp.pixelplumbing.com/
const supportedFormats: string[] = [ 'JPEG', 'JPG', 'PNG', 'WEBP', 'AVIF', 'TIFF', 'TIF', 'GIF', 'SVG', 'CR2', 'CR3', 'DNG'];

const getFileExtention = (filename: string): string => {
    if (typeof filename === 'undefined' || filename === null) {
        return null;
    }

    if (filename.startsWith('.')) {
        return null;
    }

    const index = filename.lastIndexOf('.');
    if (index < 0) {
        return null;
    }

    return filename.toUpperCase().substring(index+1);
}

const isRawFile = (filename: string): boolean => {
    const extention = getFileExtention(filename);
    if (extention === null) {
        return false;
    }
    
    let regexp = new RegExp(/CR[0-9]/);
    return regexp.test(extention);
}

const fileSupported = (filename: string): boolean => {
    const extention = getFileExtention(filename);
    if (extention === null) {
        return false;
    }
    
    const formatIndex = supportedFormats.indexOf(extention);
    return formatIndex !== -1;
}

/**
 * Generate a thumbnail image from the full image data in the provided data buffer according to the requested
 * parameters contained in the request body. Then sends this thumbnail back to the response.
 * @param req Request containing the thumb generation parameters
 * @param res Response to send the thumbnail image to
 * @param dataBuffer the databuffer read from the requested file
 */
const generateThumb = (req: express.Request, res: express.Response, dataBuffer: Buffer) => {
    const width = req.body.width ? req.body.width : 200;
    const height = req.body.heigh ? req.body.height : 200;
    sharp(dataBuffer)
        .resize({
          width: width,
          height: height,
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        }).jpeg()
        .toBuffer()            
            .then(data => {
                // TODO put data to server cache 
                res.set({
                    'Content-Type': 'image/jpeg',
                    'cache-control': 'max-age=0'
                });
                res.status(200).end(data, 'binary');
            })
            .catch(reason => {
                res.status(500).send(reason).end();
            });
}

export const register = (app: express.Application) : void => {

    // configure body parser to accept json only for /thumb/... request paths
    // in order to let the original dav server configuration untouched
    app.use('/thumb', bodyParser.urlencoded({ extended: false }));
    app.use('/thumb', bodyParser.json({ type: 'application/json' }));

    app.post('/thumb', (req, res) => {

        const homeDirPhysicalPath = findPhysicalPath(req.body.username, req.body.homeDir);

        const fullFilename = `${homeDirPhysicalPath}/${req.body.filename}`;

        if (!fs.existsSync(fullFilename)) {
            const errMsg = `${fullFilename} is not found on this server.`;
            console.log(errMsg);
            res.status(404).send(errMsg).end();
            return;
        }

        // check we support this image (if it is one)
        if (!fileSupported(fullFilename)) {
            console.error(`${req.body.filename} is not a supported file format.`);
            res.status(400).send(`${req.body.filename} is not a supported file format.`).end();
            return;
        }
        
        //TODO use cache ?

        let dataBuffer: Buffer = null;
        if (isRawFile(fullFilename)) {
            const dcrawPath = process.env.DCRAW_PATH ? process.env.DCRAW_PATH : `./tools/dcraw_emu`;
            if (!fs.existsSync(dcrawPath)) {
                const msg = `dcraw program not found as ${dcrawPath}. Skipping thumb generation for RAW image file.`;
                console.log(msg);
                res.status(400).send(msg).end();
                return;
            }

            process.env.LD_LIBRARY_PATH = './tools/.';

            const options: SpawnSyncOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 1024 * 1024 * 1024, // ONE GIGA BYTES
                env: process.env
            }
            const dcraw = child_process.spawn(dcrawPath, [ "-T", "+M", "-o", "2", "-h", "-Z", "-", fullFilename], options);
            let stdErr = '';
            dcraw.stdout.on('data', (data) => {
                dataBuffer = dataBuffer == null ? Buffer.from(data) : Buffer.concat([dataBuffer, Buffer.from(data)]);
            });
            dcraw.stderr.on('data', (data) => {
                stdErr += data.toString();
            });
            dcraw.on('close', (exitCode) => {
                if (exitCode !== 0) {
                    const errMsg = `Error while generating raw file thumb image: ${stdErr}`;
                    console.error(errMsg);
                    res.status(500).send(errMsg).end();
                    return;
                } else {
                    generateThumb(req, res, dataBuffer);
                }
            });
        } else {
            dataBuffer = fs.readFileSync(fullFilename);
            generateThumb(req, res, dataBuffer);
        }
    });
};