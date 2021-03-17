import * as express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import sharp from "sharp";

// supported formats are : JPEG, PNG, WebP, AVIF, TIFF, GIF and SVG
// see doc at : https://sharp.pixelplumbing.com/
const supportedFormats: string[] = [ 'JPEG', 'JPG', 'PNG', 'WEBP', 'AVIF', 'TIFF', 'GIF', 'SVG'];

const fileSupported = (filename: string): boolean => {
    if (typeof filename === 'undefined' || filename === null) {
        return false;
    }

    if (filename.startsWith('.')) {
        return false;
    }

    const index = filename.lastIndexOf('.');
    if (index < 0) {
        return false;
    }

    const extention = filename.toUpperCase().substring(index+1);    
    
    const formatIndex = supportedFormats.indexOf(extention);
    return formatIndex !== -1;
}

export const register = (app: express.Application) : void => {

    // configure body parser to accept json only for /thumb/... request paths
    // in order to let the original dav server configuration untouched
    app.use('/thumb', bodyParser.urlencoded({ extended: false }));
    app.use('/thumb', bodyParser.json({ type: 'application/json' }));

    app.post('/thumb', (req, res) => {

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
            res.status(204).send('').end();
            return;
        }
        
        //TODO use cache ?

        const buffer = fs.readFileSync(fullFilename);
        sharp(buffer)
        .resize({
          width: width,
          height: height,
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        }).toBuffer()
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