#!/bin/bash

# Use this script to activate queuing functions for nico.drive server.
# The queuing ensure the resize plugin will not consume to many resources on your server
# while generating thumbnails. See the dotenv-sample file for more informations on how to configure

# This scripts will CONFIGURE Rabbit MQ to you linux ubuntu server
# BEFORE RUNNING this script, run install-rabbitmq.sh if there is no rabbitmq server installed.

#### 
# check argument to be zero and otherwise exit the script
####
exit_if_error () {
    if [ $1 -ne 0 ] 
    then
        exit -99
    fi
}


# Enable the management plugin for monitoring
sudo rabbitmq-plugins enable rabbitmq_management

# create a user
# TODO : chenge the default password
sudo rabbitmqctl add_user full_access full_access

# tag the user with "administrator" for full management UI and HTTP API access
sudo rabbitmqctl set_user_tags full_access administrator

# now install the deduplication plugin at message level
# TODO : Adapt to the latest version if required. 
# See : https://github.com/noxdafox/rabbitmq-message-deduplication/

DEDUPLICATION_VERSION=0.6.3
ELIXIR_VERSION=1.16.3

wget https://github.com/noxdafox/rabbitmq-message-deduplication/releases/download/$DEDUPLICATION_VERSION/elixir-$ELIXIR_VERSION.ez 
exit_if_error $?

wget https://github.com/noxdafox/rabbitmq-message-deduplication/releases/download/$DEDUPLICATION_VERSION/rabbitmq_message_deduplication-$DEDUPLICATION_VERSION.ez
exit_if_error $?

if [ ! -f elixir-$ELIXIR_VERSION.ez ] 
then
    echo "ERROR: cannot download elixir-$ELIXIR_VERSION.ez"
    exit -1
fi

if [ ! -f rabbitmq_message_deduplication-$DEDUPLICATION_VERSION.ez ]
then
    echo "ERROR: cannot download rabbitmq_message_deduplication-$DEDUPLICATION_VERSION.ez"
    exit -2
fi

# execute rabbitmq-env to get the environments variables.
# source /usr/lib/rabbitmq/bin/rabbitmq-env
MQHOME=`dirname $(realpath /usr/lib/rabbitmq/bin/rabbitmq-env)`
MQHOME="$MQHOME/../"

PLUGINS_HOME="$MQHOME/plugins/"
echo "Rabbit MQ plugins directory is: $PLUGINS_HOME"

#Clean up of old versions if any
sudo rabbitmq-plugins disable rabbitmq_message_deduplication
sudo rm -f $PLUGINS_HOME/elixir*.ez
sudo rm -f $PLUGINS_HOME/rabbitmq_message_deduplication*.ez

# copy plugins to rabbit mq plugins directory
sudo cp elixir-$ELIXIR_VERSION.ez $PLUGINS_HOME
sudo cp rabbitmq_message_deduplication-$DEDUPLICATION_VERSION.ez $PLUGINS_HOME

# activate plugins
sudo rabbitmq-plugins enable rabbitmq_message_deduplication

# clean up 
rm *.ez

# also activate monitoring via prometheus if not already activated
sudo rabbitmq-plugins enable rabbitmq_prometheus