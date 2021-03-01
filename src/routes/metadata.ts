import * as express from "express";
import bodyParser from "body-parser";
import {ExifImage, ExifData} from "exif";

export const register = (app: express.Application) : void => {

    // configure body parser to accept json only for /meta/... request paths
    // in order to let the original dav server configuration untouched
    app.use('/meta', bodyParser.urlencoded({ extended: false }));
    app.use('/meta', bodyParser.json({ type: 'application/json' }));

    app.get('/meta/exif', (req, res) => {
        const filename: string = req.body.filename;

        if (typeof filename === 'undefined' || filename === null) {
            res.status(403).send('You must provide filename in the request body to get exif data if any.').end();
            return;
        }

        console.log(`Requesting meta info for file ${req.body.filename}`);

        const fullFilename = `${process.env.DAV_PHYSICAL_PATH}/${req.body.filename}`;

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
            res.status(402).send('Not surpported file for exif extract.').end();
        }
    });
}