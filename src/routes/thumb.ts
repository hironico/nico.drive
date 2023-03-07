import * as express from "express";
import bodyParser from "body-parser";
import { constants, createReadStream as fsCreateReadStream } from "fs";
import fspromise from "fs/promises";

import child_process, { SpawnSyncOptions } from 'child_process';

import sharp from "sharp";
import { findPhysicalPath, basicAuthHandler } from "../lib/auth";
import expressBasicAuth from "express-basic-auth";

import md5 from "../lib/md5";
import { isFileSupported, isRawFile } from "../lib/fileutils";

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
    const fileName: string = req.body.fullFilename.toString();  
    
    md5(fileName)
    .then(result => {
        req.body['md5'] = result;
        next();
    })
    .catch(reason => {
        res.status(500).send(reason).end();
    });
}

const readCachedThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const cachedFilename = `${process.env.THUMBS_REPOSITORY_PATH}/${req.body.md5}_${req.body.width}x${req.body.height}-${req.body.resizeFit}`;
    req.body['cachedFilename'] = cachedFilename;

    fspromise.stat(cachedFilename)
    .then(stat => {
        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Size': stat.size,
            'cache-control': 'max-age=0'
        });
    
        // see the punmp pattern here :
        // https://elegantcode.com/2011/04/06/taking-baby-steps-with-node-js-pumping-data-between-streams/
        const readStream = fsCreateReadStream(cachedFilename);
        readStream.on('data', function(data) {
            const flushed = res.write(data);
            // Pause the read stream when the write stream gets saturated
            if(!flushed) {
                readStream.pause();
            }
        });
        
        res.on('drain', function() {
            // Resume the read stream when the write stream gets hungry 
            readStream.resume();    
        });
        
        readStream.on('end', function() {
            res.end();        
        });
    }).catch(() => {
        // cannot stat the file so it is assumed not to exists
        // so let's ass to the next function for generating the thumb image.
        next();
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

    fspromise.access(fullFilename, constants.R_OK)
    .then(() => {
        // check we support this image (if it is one)
        if (!isFileSupported(fullFilename)) {
            const errMsg = `${req.body.filename} is not a supported file format.`;
            console.error(errMsg);
            res.status(400).send(errMsg).end();
            return;
        }

        // resizeFit is correct
        let errMsg = '';
        switch(resizeFit) {
            case 'cover':
            case 'contain':
            case 'fill':
            case 'outside':
            case 'inside':
                break;

            default:
                errMsg = `${req.body.resizeFit} is not a supported resize fit value. Should be: cover, contain, fill, outside, inside.`;
                console.error(errMsg);
                res.status(400).send(errMsg).end();
                return;
        }

        req.body['fullFilename'] = fullFilename;
        req.body['width'] = width;
        req.body['height'] = height;
        req.body['resizeFit'] = resizeFit;

        next();
    }).catch(error => {
        const errMsg = `${fullFilename} is not found or cannot be read on this server.\n${JSON.stringify(error)}`;
        console.log(errMsg);
        res.status(404).send(errMsg).end();
        return;
    });    
}

const generateRawThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let dataBuffer: Buffer = null;
    if (isRawFile(req.body.fullFilename)) {
        const dcrawPath = process.env.DCRAW_PATH ? process.env.DCRAW_PATH : `./tools/dcraw_emu`;
        process.env.LD_LIBRARY_PATH = './tools/.';
        const options: SpawnSyncOptions = {
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 1024 * 1024 * 1024, // ONE GIGA BYTES
            env: process.env
        }

        fspromise.access(dcrawPath, constants.X_OK)
        .then(() => {
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
        }).catch(error => {
            const msg = `dcraw program not found as ${dcrawPath}. Skipping thumb generation for RAW image file.\n${JSON.stringify(error)}`;
            console.log(msg);
            res.status(400).send(msg).end();
            return;
        });
    } else {
        fspromise.readFile(req.body.fullFilename)
        .then(dataBuffer => {
            req.body['dataBuffer'] = dataBuffer;
            next();
        }).catch(error => {
            const errMsg = `Cannot read content of cached thumb: ${req.body.fullFilename}.\n${JSON.stringify(error)}`;
            console.error(errMsg);
            res.status(500).send(errMsg).end();
        });        
    }
}

export const register = (app: express.Application) : void => {

    // setup the file structure for storing cached thumbs
    // operation can be done async because nothing awaits for it 
    fspromise.stat(process.env.THUMBS_REPOSITORY_PATH)
    .then(stat => {
        if (stat.isDirectory()) {
            console.log(`Thumb storage directory found: ${process.env.THUMBS_REPOSITORY_PATH}`);
        } else {
            console.error(`Not a directory: ${process.env.THUMBS_REPOSITORY_PATH} !`);
        }        
    }).catch(() => {        
        fspromise.mkdir(process.env.THUMBS_REPOSITORY_PATH, { recursive: true })
        .then(() => {
            console.log(`Thumb storage directory created: ${process.env.THUMBS_REPOSITORY_PATH}`);
        }).catch(error => {
            console.error(`CANNOT create the thumb storage directory: ${process.env.THUMBS_REPOSITORY_PATH}.\n${JSON.stringify(error)}`);
        });
    });

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