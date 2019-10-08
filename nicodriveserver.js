/*
 * @package jsDAV
 * @subpackage DAV
 * @copyright Copyright(c) 2011 Ajax.org B.V. <info AT ajax.org>
 * @author Mike de Boer <info AT mikedeboer DOT nl>
 * @license http://github.com/mikedeboer/jsDAV/blob/master/LICENSE MIT License
 */
"use strict";

var jsDAV = require("./lib/jsdav");
jsDAV.debugMode = false;

var jsDAV_Locks_Backend_FS = require("./lib/DAV/plugins/locks/fs");
var jsDAV_Auth_Backend_File = require("./lib/DAV/plugins/auth/file");

var Util = require('./lib/shared/util');

var Process = require('process');
var fs = require('fs');

global.NicoDriveConfig = require('./nicodriveconfig');

Util.log('Platform is: ' + Process.platform + ' ' + Process.arch);

// Util.log('Config: ' + JSON.stringify(Process.config, null, 4));

// generate myhtdigest
/*
htdigest -c ./myhtdigest jsdavtest mylogin

# remove empty line or it will crash into jsDAV
perl -i -pe "chomp if eof" ./myhtdigest
*/

Util.log('Configuration:\n' + JSON.stringify(NicoDriveConfig, null, 4));
Util.log('Using htdigest file as: ' + process.cwd() + '/' + NicoDriveConfig.auth.digestFile);
jsDAV.createServer({
    node: NicoDriveConfig.rootDir,
    locksBackend: jsDAV_Locks_Backend_FS.new(NicoDriveConfig.locksDir),
    authBackend:  jsDAV_Auth_Backend_File.new(process.cwd() + '/' + NicoDriveConfig.auth.digestFile),
    realm: NicoDriveConfig.auth.realm
}, 5000);

const frontendPort = NicoDriveConfig.frontend.port;
var frontend = require('./lib/frontend/frontend-server');
frontend.listen(frontendPort, () => console.log(`Frontend app listening on port ${frontendPort}!`))
