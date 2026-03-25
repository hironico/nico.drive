#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
# ensure we change the current working directory to script dir
# so that node can find the config file
cd ${SCRIPT_DIR}

echo "Updating missing library (if required...)"
npm install

echo "Building nico.drive server before any launch to make sure server is up to date !"
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

# use exec to replace the shell so that supervisord can follow up the process.
exec node ./dist/index.js > $LOG_FILE 2>&1 

