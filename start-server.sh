#!/bin/bash

LOGFILE="/var/log/sites/synobackup/nodejs.log"

echo "Log file is: $LOGFILE"

nohup node nicodriveserver.js > $LOGFILE 2>&1 &
echo $! > nico.drive.pid
echo "Server started !"
