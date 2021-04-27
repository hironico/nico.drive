import * as express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import child_process, { SpawnSyncOptions } from 'child_process';

import sharp from "sharp";



// supported formats are : JPEG, PNG, WebP, AVIF, TIFF, GIF and SVG
// see doc at : https://sharp.pixelplumbing.com/
const supportedFormats: string[] = [ 'JPEG', 'JPG', 'PNG', 'WEBP', 'AVIF', 'TIFF', 'TIF', 'GIF', 'SVG', 'CR2'];

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

    return 'CR2' === extention;
}

const fileSupported = (filename: string): boolean => {
    const extention = getFileExtention(filename);
    if (extention === null) {
        return false;
    }
    
    const formatIndex = supportedFormats.indexOf(extention);
    return formatIndex !== -1;
}

export const register = (app: express.Application) : void => {

    // configure body parser to accept json only for /thumb/... request paths
    // in order to let the original dav server configuration untouched
    app.use('/thumb', bodyParser.urlencoded({ extended: false }));
    app.use('/thumb', bodyParser.json({ type: 'application/json' }));

    app.post('/thumb', async (req, res) => {

        const fullFilename = `${process.env.DAV_PHYSICAL_PATH}/${req.body.filename}`;

        const width = req.body.width ? req.body.width : 200;
        const height = req.body.heigh ? req.body.height : 200;

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

        let dataBuffer: Buffer;
        if (isRawFile(fullFilename)) {
            const dcrawPath = process.env.DCRAW_PATH ? process.env.DCRAW_PATH : `./tools/dcraw`;
            if (!fs.existsSync(dcrawPath)) {
                const msg = `dcraw program not found as ${dcrawPath}. Skipping thumb generation for RAW image file.`;
                console.log(msg);
                res.status(400).send(msg).end();
                return;
            }
            const options: SpawnSyncOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 1024 * 1024 * 1024 // ONE GIGA BYTES
            }
            const proc = child_process.spawnSync(dcrawPath, [ '-T', '+M', '-o', '2', '-h', '-c', fullFilename], options);
            if (proc.status !== 0) {
                const errMsg = `Error while generating raw file thumb image: ${proc.error}`;
                console.error(errMsg);
                res.status(500).send(errMsg).end();
                return;
            }           
            dataBuffer = proc.stdout;
        } else {
            dataBuffer = fs.readFileSync(fullFilename);
        }

        // const 
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
    });
};