#!/bin/bash

LOG_DIR=/var/log/sites/nico.drive
LOG_FILE=$LOG_DIR/nodejs.log

mkdir -p $LOG_DIR

# make sure the libraw.so library is accessible in the LD LIB PATH.
if [ -d ./tools/ ]
then
    export LD_LIBRARY_PATH=./tools/.:$LD_LIBRARY_PATH
fi

nohup node . > $LOG_FILE 2>&1 &
PID=$!

echo $PID > nicodrive.pid

