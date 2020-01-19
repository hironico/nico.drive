const express = require('express');
const app = express();
const fileRoute = require('./server/api-file-route');

// HTTP request logger middleware.
var logger = require('morgan');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({type: 'application/octet-stream', limit : '1024mb'}))
app.use(cookieParser());

// Add headers for cors to allow other website to get access to it
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000,https://drive.hironico.net,http://drive.hironico.net,http://localhost:5500/api/file');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow    
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-nicodrive-uploadlink,x-nicodrive-filename,x-nicodrive-filesize');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


app.use('/api', fileRoute);

/*
const clientDir = path.join(__dirname, './client/build');
console.log('Starting client from: ' + clientDir);
app.use(express.static(clientDir));
*/

module.exports = app;