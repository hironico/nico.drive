import * as express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import fspromise from "fs/promises";

import child_process, { ExecException, SpawnSyncOptions } from 'child_process';

import sharp from "sharp";
import { findPhysicalPath, basicAuthHandler } from "../lib/auth";
import expressBasicAuth from "express-basic-auth";

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
    
    const regexp = new RegExp(/CR[0-9]/);
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

const writeCachedThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {    
    sharp(req.body.dataBuffer)
        .resize({
          width: req.body.width,
          height: req.body.height,
          fit: req.body.resizeFit,
          position: sharp.strategy.entropy
        }).jpeg()
        .toBuffer()            
            .then(data => {
                // console.log(`Writing cached thumb to: ${req.body.cachedFilename}`);

                fspromise.writeFile(req.body.cachedFilename, data)
                .then( () => {
                    req.body.dataBuffer = data;
                    next();
                });
            })
            .catch(reason => {
                console.log(`Error while writing the thumb jpeg cahced file to disk: ${reason}`);
                res.status(500).send(reason).end();
            });
}

const sendCachedThumb = (req: express.Request, res: express.Response) => {
    if (!req.body.dataBuffer) {
        res.status(500).send('There should be a data buffer for the thumbnail at this point.').end();
        return;
    }

    res.set({
        'Content-Type': 'image/jpeg',
        'cache-control': 'max-age=0'
    });

    res.status(200).end(req.body.dataBuffer, 'binary');
}

const generateMD5 = (req: express.Request, res: express.Response, next: express.NextFunction) => {    
    child_process.execFile('/usr/bin/env', ['openssl', 'dgst', '-md5', req.body.fullFilename.toString()], (error: ExecException, stdout: string, stderr: string) => {
        if (error) {
            const errMsg = `Cannot generate MD5 for file: ${req.body.fullFilename}.\n${stderr}`;
            console.error(errMsg);
            res.status(500).send(errMsg).end();
            return;
        }

        const md5 = stdout.toString().split('=')[1].trim();
        req.body['md5'] = md5;
        next();
    });
}

const readCachedThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!fs.existsSync(process.env.THUMBS_REPOSITORY_PATH)) {
        console.log(`Creating thumbs directory path: ${process.env.THUMBS_REPOSITORY_PATH}`);
        fs.mkdirSync(process.env.THUMBS_REPOSITORY_PATH, { recursive: true });
    }

    const cachedFilename = `${process.env.THUMBS_REPOSITORY_PATH}/${req.body.md5}_${req.body.width}x${req.body.height}-${req.body.resizeFit}`;
    req.body['cachedFilename'] = cachedFilename;

    if (!fs.existsSync(cachedFilename)) {
        next();
        return;
    }

    const stat = fs.statSync(cachedFilename);

    res.set({
        'Content-Type': 'image/jpeg',
        'Content-Size': stat.size,
        'cache-control': 'max-age=0'
    });

    // see the punmp pattern here :
    // https://elegantcode.com/2011/04/06/taking-baby-steps-with-node-js-pumping-data-between-streams/
    const readStream = fs.createReadStream(cachedFilename);
    readStream.on('data', function(data) {
        const flushed = res.write(data);
        // Pause the read stream when the write stream gets saturated
        if(!flushed) {
            readStream.pause()
        }
    });
    
    res.on('drain', function() {
        // Resume the read stream when the write stream gets hungry 
        readStream.resume();    
    });
    
    readStream.on('end', function() {
        res.end();        
    });
}

/**
 * Check parameters middleware that will abort if something wrong. Then forward to next function if all ok.
 * @param req the thhp request
 * @param res the http response
 * @param next  the next function (most probably the thumb caching handlier)
  */
const thumbCheckParams = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const homeDirPhysicalPath = findPhysicalPath(req.body.username, req.body.homeDir);

    const fullFilename = `${homeDirPhysicalPath}/${req.body.filename}`;
    const width = req.body.width ? req.body.width : 200;
    const height = req.body.height ? req.body.height : 200;
    const resizeFit = req.body.resizeFit ? req.body.resizeFit : sharp.fit.cover;

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

    // resizeFit is correct
    switch(resizeFit) {
        case 'cover':
        case 'contain':
        case 'fill':
        case 'outside':
        case 'inside':
            break;

        default:
            console.error(`${req.body.resizeFit} is not a supported resize fit value. Should be: cover, contain, fill, outside, inside.`);
            res.status(400).send(`${req.body.resizeFit} is not a supported resize fit value. Should be: cover, contain, fill, outside, inside.`).end();
            return;
    }

    req.body['fullFilename'] = fullFilename;
    req.body['width'] = width;
    req.body['height'] = height;
    req.body['resizeFit'] = resizeFit;

    next();
}

const generateRawThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let dataBuffer: Buffer = null;
    if (isRawFile(req.body.fullFilename)) {
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
        const dcraw = child_process.spawn(dcrawPath, [ "-T", "+M", "-o", "2", "-h", "-Z", "-", req.body.fullFilename], options);
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
                req.body['dataBuffer'] = dataBuffer;
                next();
            }
        });
    } else {
        dataBuffer = fs.readFileSync(req.body.fullFilename);
        req.body['dataBuffer'] = dataBuffer;
        next();
    }
}

export const register = (app: express.Application) : void => {

    // first protect the API using the basic Auth handler
    app.use('/thumb', expressBasicAuth({ authorizer: basicAuthHandler }));

    // configure body parser to accept json only for /thumb/... request paths
    // in order to let the original dav server configuration untouched
    app.use('/thumb', bodyParser.urlencoded({ extended: false }));
    app.use('/thumb', bodyParser.json({ type: 'application/json' }));

    app.post('/thumb', thumbCheckParams);
    app.post('/thumb', generateMD5);
    app.post('/thumb', readCachedThumb);
    app.post('/thumb', generateRawThumb);
    app.post('/thumb', writeCachedThumb);
    app.post('/thumb', sendCachedThumb);
};