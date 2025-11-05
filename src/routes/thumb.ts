import * as express from "express";
import bodyParser from "body-parser";
import { constants, createReadStream as fsCreateReadStream } from "fs";
import fspromise from "fs/promises";
import sharp from "sharp";
import { findPhysicalPath } from "../lib/auth";

import { isFileSupported } from "../lib/fileutils";
import { getCachedImageFilename, ThumbRequest } from "../lib/imageutils";

import { QueueManager } from "../lib/thumbqueuemanager";

// one signle insttance of queue manager
const thumbQueueManager = new QueueManager(Number.parseInt(process.env.THUMBS_REQUEST_QUEUE_PREFETCH));

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
        // cannot stat the file so it is assumed not to exists or being generated.
        // failIfNotFound flag is here to make the api call fail if not found, otherwise we give hand to next middleware
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

/**
 * Sends a thumb request generation into the queue and response with 202 status code with 'LOCKED' content.
 * @param req request
 * @param res response
 */
const generateThumb = (req: express.Request, res: express.Response) => {    
    const thumbReq: ThumbRequest = {
        fullFilename: req.body.fullFilename,
        height: req.body.height,
        width: req.body.width,
        resizeFit: req.body.resizeFit
    }

    console.log('Sending thumb request to queue manager: ' + JSON.stringify(thumbReq));
    thumbQueueManager.enqueue({id: thumbReq.fullFilename, request: thumbReq});

    // do not wait for the process to finish and tell the browser to come back later
    console.log(`Thumb request to queue sent OK. Queue size: ${thumbQueueManager.getQueueLength()} / ${thumbQueueManager.getProcessingCount()} : processing: ${thumbQueueManager.isProcessing}`);
    res.status(202).send('LOCKED').end();
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

    console.log('Now setting up thumbs API...');
    
    // configure body parser to accept json only for /thumb/... request paths
    // in order to let the original dav server configuration untouched
    app.use('/thumb', bodyParser.urlencoded({ extended: false }));
    app.use('/thumb', bodyParser.json({ type: 'application/json' }));

    app.post('/thumb', thumbCheckParams);
    app.post('/thumb', getCachedFilename);
    app.post('/thumb', sendCachedThumb);
    app.post('/thumb', generateThumb);
};