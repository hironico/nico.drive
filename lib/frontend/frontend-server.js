const express = require('express');
const nicordriveconfig = require('../../nicodriveconfig');
const app = express();

// HTTP request logger middleware.
var logger = require('morgan');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

const port = nicordriveconfig.frontend.port;

app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({type: 'application/octet-stream', limit : '8mb'}))
app.use(cookieParser());

app.get('/', (req, res) => res.send('Hello World!'));

module.exports = app;