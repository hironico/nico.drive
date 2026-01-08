#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
# ensure we change the current working directory to script dir
# so that node can find the config file
cd ${SCRIPT_DIR}

PID_FILE="nicodrive.pid"
if [ -f $PID_FILE ]
then
    kill -9 `cat $PID_FILE`
    rm $PID_FILE
else 
    echo "No PID file was found. Could not stop nicodrive: $PID_FILE"
fi

echo 'Trying to get the PID of the node program running on the configured server port...'

if [ ! -f .env ]
then
    echo "Cannot find the .env configuration file. Can't stop the server."
    exit -99
fi

SERVER_PORT=`cat .env | grep SERVER_PORT | cut -d '=' -f 2` 

echo "Found configured server port: $SERVER_PORT"

PID=`lsof -i :3443 | grep node | tr -s ' ' ' ' | cut -d ' ' -f 2`

echo "Kill PID $PID ..."

kill -9 $PID

if [ $? -ne 0 ]
then
    echo "Problem while killing server with PID: $PID"
else
    echo "Server killed."
fi

