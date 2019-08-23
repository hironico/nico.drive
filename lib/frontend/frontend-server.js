const express = require('express');
var path = require('path');
const nicordriveconfig = require('../../nicodriveconfig');
const app = express();
const fileRoute = require('./server/api-file-route');

global.appRoot = path.resolve(__dirname,'data');

// HTTP request logger middleware.
var logger = require('morgan');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

const port = nicordriveconfig.frontend.port;

app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({type: 'application/octet-stream', limit : '1024mb'}))
app.use(cookieParser());

app.use(express.static('lib/frontend/client/build'));

app.use('/api', fileRoute);

module.exports = app;