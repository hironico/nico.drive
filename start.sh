#!/bin/bash

nohup node . > /var/log/sites/synobackup/nodejs.log 2>&1 &
PID=$!

echo $PID > nicodrive.pid

