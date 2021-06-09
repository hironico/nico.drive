#!/bin/bash

PID_FILE="nicodrive.pid"

if [ -f $PID_FILE ]
then
    kill -9 `cat $PID_FILE`
    rm $PID_FILE
else 
    echo "No PID file was found. Could not stop nicodrive: $PID_FILE"
fi


