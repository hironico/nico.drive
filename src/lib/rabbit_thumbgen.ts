import amqp from 'amqplib';
import dotenv from 'dotenv';

import { generateAndSaveThumb, ThumbRequest } from './imageutils';

// ensure config is ready
// init environment configuration
dotenv.config();

// global variables
const queue = process.env.THUMBS_REQUEST_QUEUE_NAME;
const prefetchSize = parseInt(process.env.THUMBS_REQUEST_QUEUE_PREFETCH);

let channel: amqp.Channel;

// build a thumb from a request contained in the message 
// and ack the message to get next one
const buildThumbFromMessage = (msg: amqp.ConsumeMessage) => {
    const strContent: string = msg.content.toString();    
    console.log(" [x] Received %s", strContent);

    const request: ThumbRequest = JSON.parse(strContent);    
    generateAndSaveThumb(request.fullFilename, request.width, request.height, request.resizeFit)
        .then(outputInfo => {
            console.log(`Thumb for ${request.fullFilename} has been dynamically generated: ${outputInfo}`);
        }).catch(error => {
            if (error.name === 'LOCKED') {
                console.log(error.message);
            } else {
                const errMsg = `Cannot generate thumb for file: ${request.fullFilename}.\n${error}`;
                console.error(errMsg);
            }
        }).finally(() => {
            channel.ack(msg);
        })
}

export const listenToThumbQueue = () => {
    amqp.connect('amqp://localhost')
        .then(connection => {
            return connection.createChannel()
                .then(ch => {
                    channel = ch;

                    channel.assertQueue(queue);

                    // process prefetchSize message(s) at a time. See .env config file.
                    channel.prefetch(prefetchSize);

                    channel.consume(queue, buildThumbFromMessage);

                    console.log(" [*] Waiting for thumb requests in %s. To exit press CTRL+C", queue);
                })
        })
        .catch(reason => {
            console.log('Cannot connect to rabbit thumb requests queue. ' + reason);
        });
}

export const publishToThumbQueue = (request: ThumbRequest): Promise<void> => {
    return new Promise<void>( (resolve, reject) => {
        amqp.connect('amqp://localhost')
        .then(connection => {
            connection.createChannel()
                .then(ch => {
                    ch.assertQueue(queue, {
                        durable: true
                    });

                    const msg = JSON.stringify(request);
                    if ( !ch.sendToQueue(queue, Buffer.from(msg)) ) {
                        console.error('Could not send thumb request to queue !');
                    }

                    /*
                    ch.close();
                    console.log('Channel closed.');

                    connection.close();
                    console.log('Connection closed.');
                    */

                    resolve();
                });
        }).catch(error => {
            reject(error);
        })
    });
}
