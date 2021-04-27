#!/bin/bash

LOG_FILE="build_dcraw.log"

echo "Building dcraw requires GCC (you can get it from build-essentials packages)."
echo "Check this page for instructions: https://www.dechifro.org/dcraw/"
echo "Now building dcraw..."

gcc -o dcraw -O4 dcraw.c -lm -DNODEPS > ${LOG_FILE} 2>&1

if [ $? -ne 0 ]
then
    echo "/!\ An error has occured while building DCRAW."
fi

echo "Finished building dcraw for your system."
echo "Open ${LOG_FILE} for details."
echo "Bye."