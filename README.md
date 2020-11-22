# nico.drive
## Description
Hironico nico.drive is a webdav server running on nodejs express. It features a nice user interface to access your files as well as a admin management console to help manage the repositories and users.
## Developper information

### Getting started
In order to get it up and running in your environment, you need :
- To create a slef signed certificate and its key files or use [Let's Encrypt](https://letsencrypt.org/) for production.
- COPY the "dotenv-sample" file into a file named ".env", then Adapt to reflect your current setup.
- npm install
- npm run build
- npm run start
- Connect WebDav client to your new server

### Full documentation reference

* In order to setup the project we used a slightly updated version of the tutorial available here at [okta](https://developer.okta.com/blog/2018/11/15/node-express-typescript)
* tslint being outdated, we used eslint instead with instructions here [Getting started with eslint](https://eslint.org/docs/user-guide/getting-started)
* In order to get HTTPS working we followed the following tutorial: [Running ExpressJS server over HTTPS](https://timonweb.com/javascript/running-expressjs-server-over-https/)
* After that we needed configuration options: [so we use the dotEnv project](https://developer.okta.com/blog/2018/11/15/node-express-typescript#a-better-way-to-manage-configuration-settings-in-nodejs)
* Created the azure-pipelines.yml to get continuous integration from Azure DevOps

