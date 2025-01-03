import amqp from 'amqplib';
import dotenv from 'dotenv';
import { Worker } from 'worker_threads';

import { ThumbRequest } from './imageutils';

// ensure config is ready
// init environment configuration
dotenv.config();

// global variables
const queue = process.env.THUMBS_REQUEST_QUEUE_NAME;
const prefetchSize = parseInt(process.env.THUMBS_REQUEST_QUEUE_PREFETCH);

let subscribe_channel: amqp.Channel;

const buildThumbFromMessageAsync = (msg: amqp.ConsumeMessage) => {
    console.log('Received a thumb request message.');
    const strContent: string = msg.content.toString();
    console.log(" [x] Received %s", strContent);

    const request: ThumbRequest = JSON.parse(strContent);
    const w = new Worker('./src/lib/workerlauncher_thumbgen.js', {
        workerData: {
            request: request
        }
    });

    w.on('message', (result) => {
        console.log(result);
    });

    w.on('exit', (code) => {
        if (code != 0) {
            console.log(`WARNING: thumb generator thread exited with return code: ${code}`);
        }

        // do not forget to ack the message once the worker has started 
        subscribe_channel.ack(msg);
    });
}

export const listenToThumbQueue = () => {
    console.log('Listen to thumb queue...');
    amqp.connect( {
        hostname: process.env.THUMBS_REQUEST_QUEUE_HOSTNAME,
        username: process.env.THUMBS_REQUEST_QUEUE_USER,
        password: process.env.THUMBS_REQUEST_QUEUE_PASS
    }).then(connection => {
            return connection.createChannel()
                .then(ch => {
                    subscribe_channel = ch;

                    const opts: amqp.Options.AssertQueue = {
                        durable: true,
                        arguments: {
                            "x-message-deduplication": true,
                            "x-queue-type": "classic"
                        } 
                    }
                    subscribe_channel.assertQueue(queue, opts);

                    // process prefetchSize message(s) at a time. See .env config file.
                    subscribe_channel.prefetch(prefetchSize);

                    subscribe_channel.consume(queue, buildThumbFromMessageAsync);

                    console.log(" [*] Waiting for thumb requests in %s. Prefetch size is: %d", queue, prefetchSize);
                }).catch(error => console.log(error));
        })
        .catch(reason => {
            console.log('Cannot connect to rabbit thumb requests queue. ' + reason);
        });
}

export const publishToThumbQueue = async (request: ThumbRequest): Promise<void> => {
    const connection = await amqp.connect({
            hostname: process.env.THUMBS_REQUEST_QUEUE_HOSTNAME,
            username: process.env.THUMBS_REQUEST_QUEUE_USER,
            password: process.env.THUMBS_REQUEST_QUEUE_PASS
        });
    const publish_channel = await connection.createChannel();
    const queueOpts: amqp.Options.AssertQueue = {
        durable: true,
        arguments: {
            "x-message-deduplication" : true
        }
    }
    await publish_channel.assertQueue(queue, queueOpts);

    const opts: amqp.Options.Publish = {
        headers: {
            "x-deduplication-header": request.fullFilename,
        },
        persistent: true
    }

    return new Promise<void>((accept, reject) => {
        const msg = JSON.stringify(request);
        if (!publish_channel.sendToQueue(queue, Buffer.from(msg), opts)) {
            const errMsg = 'Could not send thumb request to queue !';
            console.error(errMsg);
            reject(errMsg);
        } else {
            publish_channel.close()
                .then(() => connection.close())
                .then(() => accept())
                .catch(error => reject(error));            
        }
    });
}

export const messageCountThumbQueue = async (): Promise<number> => {
    const connection = await amqp.connect({
        hostname: process.env.THUMBS_REQUEST_QUEUE_HOSTNAME,
        username: process.env.THUMBS_REQUEST_QUEUE_USER,
        password: process.env.THUMBS_REQUEST_QUEUE_PASS
    });
    const publish_channel = await connection.createChannel();
    const queueOpts: amqp.Options.AssertQueue = {
        durable: true,
        arguments: {
            "x-message-deduplication" : true
        }
    }

    const response = await publish_channel.assertQueue(queue, queueOpts);
    return new Promise<number>((accept, reject) => {
        if (response.messageCount) {
            publish_channel.close()
                .then(() => connection.close())
                .then(() => accept(response.messageCount))
                .catch(error => reject(error));            
        } else {
            reject(`Cannot get message count from thumb queue: ${queue}`);
        } 
    });    
}
