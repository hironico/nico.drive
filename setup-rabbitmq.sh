#!/bin/bash

# Use this script to activate queuing functions for nico.drive server.
# The queuing ensure the resize plugin will not consume to many resources on your server
# while generating thumbnails. See the dotenv-sample file for more informations on how to configure

# This scripts will CONFIGURE Rabbit MQ to you linux ubuntu server
# BEFORE RUNNING this script, run install-rabbitmq.sh if there is no rabbitmq server installed.

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
wget https://github.com/noxdafox/rabbitmq-message-deduplication/releases/download/0.6.2/elixir-1.14.0.ez >/dev/null 2>&1
wget https://github.com/noxdafox/rabbitmq-message-deduplication/releases/download/0.6.2/rabbitmq_message_deduplication-0.6.2.ez >/dev/null 2>&1

if [ ! -f elixir-1.14.0.ez ] 
then
    echo "ERROR: cannot download elixir-1.14.0.ez"
    exit -1
fi

if [ ! -f rabbitmq_message_deduplication-0.6.2.ez ]
then
    echo "ERROR: cannot download rabbitmq_message_deduplication-0.6.2.ez"
    exit -2
fi

# execute rabbitmq-env to get the environments variables.
# source /usr/lib/rabbitmq/bin/rabbitmq-env
MQHOME=`dirname $(realpath /usr/lib/rabbitmq/bin/rabbitmq-env)`
MQHOME="$MQHOME/../"

PLUGINS_HOME="$MQHOME/plugins/"
echo "Rabbit MQ plugins directory is: $PLUGINS_HOME"

# copy plugins to rabbit mq plugins directory
sudo cp elixir-1.14.0.ez $PLUGINS_HOME
sudo cp rabbitmq_message_deduplication-0.6.2.ez $PLUGINS_HOME

# activate plugins
sudo rabbitmq-plugins enable rabbitmq_message_deduplication

# clean up 
rm *.ez