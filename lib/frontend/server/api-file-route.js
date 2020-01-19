const express = require('express');
const fs = require('fs');
var path = require('path');

const nicoDriveconfig = require('../../../nicodriveconfig');

const router = express.Router();

const appRoot = nicoDriveconfig.rootDir;

router.get('/search/:linkValue', (req, res, next) => {

    const linkValue = req.params.linkValue;
    if (typeof(linkValue) === 'undefined' || '' === linkValue) {
        res.status(404).send('No link value provided.').end();
        return;
    }

    var files = [
        {
            'name' : 'filename1',
            'path' : 'dir/truc/machin/file1',
            'size': 12345
        },
        {
            'name': 'filename2',
            'path' : 'dir/truc/machin/file2',
            'size': 67890
        }
    ];

    res.status(200).send(JSON.stringify(files)).end();
});

router.get('/file', (req, res, next) => {
    const uploadLink = req.headers['x-nicodrive-uploadlink'];
    if (typeof uploadLink === 'undefined') {
        res.status(404).send('No upload link in request.').end();
        return;
    }

    // if link directory is not found then tells the client about it.
    const linkDirectory = path.join(appRoot, uploadLink);
    if (!fs.existsSync(linkDirectory)) {
        res.status(404).send('Incorrect upload link: not found.').end();
        return;
    }

    res.status(200).send('Cool the folder exists').end();
});


/**
 * Upload a file into the data directory for thespecified link.
 * File details are in the custom request headers
 * Content is in the body of the request.
 */
router.post('/file', (req, res, next) => {
    // get the nicodrive custom headers fromthe request

    console.log(JSON.stringify(req.headers));

    const uploadLink = req.headers['x-nicodrive-uploadlink'];
    if (typeof uploadLink === 'undefined') {
        res.status(403).send('No upload link in request.').end();
        return;
    }

    const fileName = req.headers['x-nicodrive-filename'];
    if (typeof fileName === 'undefined') {
        res.status(403).send('No filename in request.').end();
        return;
    }

    const fileSize = req.headers['x-nicodrive-filesize'];
    if (typeof fileSize === 'undefined') {
        res.status(403).send('No fileSize in request.').end();
        return;
    }

    // create link directory if needed
    const linkDirectory = path.join(appRoot, uploadLink);
    if (!fs.existsSync(linkDirectory)) {
        fs.mkdirSync(linkDirectory);
    }

    saveFile(uploadLink, fileName, req, res);

});

var saveFile = function (linkDirectory, fileName, req, res) {
    var filePath = path.join(appRoot, linkDirectory, fileName);
    console.log('Saving file into: ' + filePath);
    fs.open(filePath, 'w', (err, fd) => {
        if (err) {
            console.log('Error while opening file for writing. Check storage path and access rights.');
            console.log('Filepath was: ' + filePath);
            res.status(500).send('Error while opening file for writing. Check storage path and access rights.').end();
            return;
        } else {
            fs.write(fd, req.body, null, null, null, function (err) {
                if (err) {
                  console.log('Error while writing file to disk.' + err);
                  res.status(500).send('Error while writing file to disk.').end();
                  return;
                } else {
                  fs.close(fd, function () {
                    console.log('Wrote the file successfully');
                    res.status(200).send('Wrote the bottle picture sucessfully.').end();
                    return;
                  });
                }
              });
        }
    });
};

module.exports = router;