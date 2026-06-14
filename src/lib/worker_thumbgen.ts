import dotenv from 'dotenv';
import { ThumbRequest, generateAndSaveThumb } from './imageutils';
import { parentPort } from 'worker_threads';

// get the configuration from the .env file
dotenv.config();

export const generateThumb = (request: ThumbRequest): void => {
        generateAndSaveThumb(request.fullFilename, request.width, request.height, request.resizeFit)
        .then(() => {
            if (parentPort) {
                parentPort.postMessage({ success: true });
            }
        })
        .catch(error => {
            if (error.name === 'LOCKED') {
                console.log(error.message);
                if (parentPort) {
                    parentPort.postMessage({ success: false, error: error.message });
                }
            } else {
                const errMsg = `Cannot generate thumb for file: ${request.fullFilename}.\n${error}`;
                console.error(errMsg);
                if (parentPort) {
                    parentPort.postMessage({ success: false, error: errMsg });
                }
            }
        });
    }
