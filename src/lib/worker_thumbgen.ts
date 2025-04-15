import dotenv from 'dotenv';
import { ThumbRequest, generateAndSaveThumb } from './imageutils';

// get the configuration from the .env file
dotenv.config();

export const generateThumb = (request: ThumbRequest):void => {
        generateAndSaveThumb(request.fullFilename, request.width, request.height, request.resizeFit)
        .catch(error => {
            if (error.name === 'LOCKED') {
                console.log(error.message);
            } else {
                const errMsg = `Cannot generate thumb for file: ${request.fullFilename}.\n${error}`;
                console.error(errMsg);
            }
        });
    }
