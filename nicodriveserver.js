/*
 * @package jsDAV
 * @subpackage DAV
 * @copyright Copyright(c) 2011 Ajax.org B.V. <info AT ajax.org>
 * @author Mike de Boer <info AT mikedeboer DOT nl>
 * @license http://github.com/mikedeboer/jsDAV/blob/master/LICENSE MIT License
 */
"use strict";

var jsDAV = require("./lib/jsdav");
jsDAV.debugMode = true;

var jsDAV_Locks_Backend_FS = require("./lib/DAV/plugins/locks/fs");
var jsDAV_Auth_Backend_File = require("./lib/DAV/plugins/auth/file");

var Util = require('./lib/shared/util');
var Process = require('process');

var Config = require('./nicodriveconfig');

Util.log('Platform is: ' + Process.platform + ' ' + Process.arch);

// Util.log('Config: ' + JSON.stringify(Process.config, null, 4));

// generate myhtdigest
/*
htdigest -c ./myhtdigest jsdavtest mylogin

# remove empty line or it will crash into jsDAV
perl -i -pe "chomp if eof" ./myhtdigest
*/

Util.log('Configuration:\n' + JSON.stringify(Config, null, 4));


jsDAV.createServer({
    node: Config.rootDir,
    locksBackend: jsDAV_Locks_Backend_FS.new(Config.locksDir),
    authBackend:  jsDAV_Auth_Backend_File.new(Config.auth.digestFile),
    realm: Config.auth.realm,

    key: fs.readFileSync(Config.ssl.keyFile),
    cert: fs.readFileSync(Config.ssl.certFile)
}, 8000);
