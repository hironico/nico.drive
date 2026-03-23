const path = require('path');
const { workerData } = require('worker_threads');

console.log(`Worker data is ${JSON.stringify(workerData)}`);

// note that the application must have been build once prior to launch this worker
const { generateThumb } = require(path.resolve(__dirname, './worker_thumbgen.js'));

generateThumb(workerData.request);