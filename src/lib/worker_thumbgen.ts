import dotenv from 'dotenv';
import { ThumbRequest, generateAndSaveThumb } from './imageutils';

// get the configuration from the .env file
dotenv.config();

console.log('Inside worker_thumbgen after dotenv config.');

export const generateThumb = (request: ThumbRequest):void => {
        console.log(`Thumb request for worker is ${JSON.stringify(request)}`);

        generateAndSaveThumb(request.fullFilename, request.width, request.height, request.resizeFit)
        .then(outputInfo => {
            console.log(`Thumb for ${request.fullFilename} has been generated: ${outputInfo}`);
        }).catch(error => {
            if (error.name === 'LOCKED') {
                console.log(error.message);
            } else {
                const errMsg = `Cannot generate thumb for file: ${request.fullFilename}.\n${error}`;
                console.error(errMsg);
            }
        }).finally(() => {
            console.log(`Thumb request for ${request.fullFilename} is finished.`);
        });
    }
