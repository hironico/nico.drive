const path = require('path');
const { workerData } = require('worker_threads');

console.log(`Worker data is ${JSON.stringify(workerData)}`);

require('ts-node').register();
const { generateThumb } = require(path.resolve(__dirname, './worker_thumbgen.ts'));

generateThumb(workerData.request);