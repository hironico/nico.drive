#!/bin/bash

echo "Updating missing library (if required...)"
npm install

echo "Building nico.drive server before any launch to make sure server is upto date !"
npm run build
ret=$?

if [ $ret -ne 0 ]
then
    echo "ERROR while building server. Aborting start."
    exit -99
fi

TODAY=`date +%Y%m%d%H%M%S`
LOG_DIR=/var/log/sites/nico.drive
LOG_FILE=$LOG_DIR/${TODAY}_nodejs.log

mkdir -p $LOG_DIR

# make sure the libraw.so library is accessible in the LD LIB PATH.
if [ -d ./tools/ ]
then
    export LD_LIBRARY_PATH=./tools/.:$LD_LIBRARY_PATH
fi

nohup node . > $LOG_FILE 2>&1 &
PID=$!

echo $PID > nicodrive.pid

echo "Log file is: $LOG_FILE"
echo "nico.drive server started with PID=$PID !"

