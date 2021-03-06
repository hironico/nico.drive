# nico.drive

Hironico's nico.drive is a webdav server running on nodejs. It features full support of WebDAV protocol plus additional exclusive features to ease display and search of hosted files. To take full advantage of the additional APIs, the server comes with its own web application embbedded (aka the nico.drive.client project). 

It's an all-in-one solution to backup important files and memories yet very simple to install and use.

## Features
* WebDAV compliant server compatible with all WebDav enabled devices such as NAS (Synology, QNap etc...)
* Out of the box ready to run but also highly configurable (see dotenv-sample file)
* Additional features as additional REST api :
    - image thumbnail generator
    - image metadata API support for EXIF and XMP
    - digital camera raw file formats support for thumbs
* Embedded WebDAV explorer web application

## Getting started
In order to get it up and running in your environment, you need :
- A server box : private cloud or dedicated machine, the choice is yours. For instance, we use a Linux dedicated box.
- An SSL certificate (with its key). Self signed for development/testing or use [Let's Encrypt](https://letsencrypt.org/) for production.

Assuming you have configured your box with a dedicated user ; to run your server, then you need to:
- Git clone the repository
- COPY the "dotenv-sample" file into a file named ".env", then adapt to reflect your current setup.
- npm install
- npm run build
- If you have digital camera files: npm run dcraw
- npm run start
- Connect WebDav client to your new server (follow vendor instructions)

  or
  
  Point you browser at the root url of your server (see .env file for setup)

## Developper information

The following is developper instructions about the way Nico's Drive has been built.
Is contains various links where the author found instructions on how to setup teh development environment,
code, libraries used etc...

### Full documentation reference (educational)

* In order to setup the project we used a slightly updated version of the tutorial available here at [okta](https://developer.okta.com/blog/2018/11/15/node-express-typescript)
* tslint being outdated, we used eslint instead with instructions here [Getting started with eslint](https://eslint.org/docs/user-guide/getting-started)
* In order to get HTTPS working we followed the following tutorial: [Running ExpressJS server over HTTPS](https://timonweb.com/javascript/running-expressjs-server-over-https/)
* After that we needed configuration options: [so we use the dotEnv project](https://developer.okta.com/blog/2018/11/15/node-express-typescript#a-better-way-to-manage-configuration-settings-in-nodejs)
* Created the azure-pipelines.yml to get continuous integration from Azure DevOps
* Thumbnail library is [SHARP](https://www.npmjs.com/package/sharp)
* Digital Camera RAW file support added via dcraw : https://www.dechifro.org/dcraw/

