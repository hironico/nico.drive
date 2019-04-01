/*
 * @package jsDAV
 * @subpackage DAV
 * @copyright Copyright(c) 2011 Ajax.org B.V. <info AT ajax.org>
 * @author Mike de Boer <info AT mikedeboer DOT nl>
 * @license http://github.com/mikedeboer/jsDAV/blob/master/LICENSE MIT License
 */
"use strict";

var jsDAV = require("./../lib/jsdav");
jsDAV.debugMode = true;

var jsDAV_Locks_Backend_FS = require("./../lib/DAV/plugins/locks/fs");
var jsDAV_Auth_Backend_File = require("./../lib/DAV/plugins/auth/file");

var Util = require('./../lib/shared/util');
var Process = require('process');

Util.log('Platform is: ' + Process.platform + ' ' + Process.arch);

// Util.log('Config: ' + JSON.stringify(Process.config, null, 4));

// generate myhtdigest
/*
htdigest -c ./myhtdigest jsdavtest mylogin

# remove empty line or it will crash into jsDAV
perl -i -pe "chomp if eof" ./myhtdigest
*/

jsDAV.createServer({
    node: __dirname + "/../test/assets",
    locksBackend: jsDAV_Locks_Backend_FS.new(__dirname + "/../test/assets"),
    authBackend:  jsDAV_Auth_Backend_File.new(__dirname + "/myhtdigest"),
    realm: "jsdavtest"
}, 8000);
