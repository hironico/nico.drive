import * as express from "express";
import bodyParser from "body-parser";
import { constants, createReadStream as fsCreateReadStream } from "fs";
import fspromise from "fs/promises";
import sharp from "sharp";
import { findPhysicalPath, basicAuthHandler } from "../lib/auth";
import expressBasicAuth from "express-basic-auth";

import { isFileSupported } from "../lib/fileutils";
import { getCachedImageFilename } from "../lib/imageutils";
import { generateAndSaveThumb } from "../lib/imageutils";

const sendThumb = (req: express.Request, res: express.Response, next: express.NextFunction, failIfNotFound: boolean) => {
    fspromise.stat(req.body.cachedFilename)
    .then(stat => {
        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Size': stat.size,
            'cache-control': 'max-age=0'
        });
    
        // see the punmp pattern here :
        // https://elegantcode.com/2011/04/06/taking-baby-steps-with-node-js-pumping-data-between-streams/
        const readStream = fsCreateReadStream(req.body.cachedFilename);
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
    }).catch((error) => {
        // cannot stat the file so it is assumed not to exists
        // if should fail then do so otherwise give hand to next middleware.
        if (failIfNotFound) {
            res.status(404).send(`Cannot find thumb in the cache: ${error}.`).end();
        } else {
            next();
        }
    });    
}

const getCachedFilename = (req: express.Request, res: express.Response, next: express.NextFunction) => { 
    getCachedImageFilename(req.body.fullFilename, req.body.width, req.body.height, req.body.resizeFit)
    .then(cachedFilename => {
        req.body['cachedFilename'] = cachedFilename;
        next();
    }).catch(reason => {
        res.status(500).send(reason).end();
    });    
}

const sendCachedThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // try to send the cached thumb if exists. If not then try to go on generation
    sendThumb(req, res, next, false);
}

const sendGeneratedThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // try to send the generated thumb that should have been generated and cached in the previous middelwares.
    sendThumb(req, res, next, true);
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

const generateThumb = (req: express.Request, res: express.Response, next: express.NextFunction) => {    
    generateAndSaveThumb(req.body.fullFilename, Number.parseInt(req.body.width), Number.parseInt(req.body.height), req.body.resizeFit)
    .then(outputInfo => {
        console.log(`Thumb for ${req.body.fullFilename} has been dynamically generated with format: ${outputInfo.format}.`);
        next();
    }).catch(error => {
        const errMsg = `Cannot generate thumb for file: ${req.body.fullFilename}.\n${error}`;
        console.error(errMsg);
        res.status(500).send(errMsg).end();
    })
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
    app.post('/thumb', getCachedFilename);
    app.post('/thumb', sendCachedThumb);
    app.post('/thumb', generateThumb);
    app.post('/thumb', sendGeneratedThumb);
};