#! /bin/bash

podman run --name keycloak-hironico -p 9443:8443 -p 9000:9000 -p 9090:8080 \
       --network=hironico-network \
       --hostname=hironico-keycloak \
       -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=change_me \
       hironico_keycloak \
       start-dev --hostname=localhost

# set --hostname differetn to localhost when deploying on a production server. 
# to be not confused with hostname parameter of podman command which defines the hostname in the user defined network