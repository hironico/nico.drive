FROM quay.io/keycloak/keycloak:latest AS builder

# Enable health and metrics support
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Configure a database vendor
ENV KC_DB=postgres

WORKDIR /opt/keycloak
# for demonstration purposes only, please make sure to use proper certificates in production instead
RUN keytool -genkeypair -storepass password -storetype PKCS12 -keyalg RSA -keysize 2048 -dname "CN=server" -alias server -ext "SAN:c=DNS:localhost,IP:127.0.0.1" -keystore conf/server.keystore

# SSL configuration 
# Development : create self signed certs with mkcerts 
#COPY /path/to/key.pem /opt/keycloak/config/ssl/key.pem
#COPY /path/to/cert.pem /opt/keycloak/config/ssl/cert.pem

# Production : use a volume that point to cert and key folder
#ENV KC_HTTPS_CERTIFICATE_FILE=/opt/keycloak/config/ssl/cert.pem
#ENV KC_HTTPS_CERTIFICATE_KEY_FILE=/opt/keycloak/config/ssl/key.pem

# Build the server with the defined config
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:latest
COPY --from=builder /opt/keycloak/ /opt/keycloak/

# change these values to point to a running postgres instance
ENV KC_DB=postgres
ENV KC_DB_URL=jdbc:postgresql://hironico-postgresql:5432/hironico_auth
ENV KC_DB_USERNAME=hironico_auth
ENV KC_DB_PASSWORD=changeme
ENV KC_HOSTNAME=localhost

# what to start when container is firing up
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]

# to start the build process run the following command
# podman|docker build . -t hironico_keycloak -f podmanbuild_keycloak.Dockerfile

# to start the container run the follwing command eventually addign the -pod switch to add it to a pod
# expose ports via -p host_port:container_port
# podman|docker run --name hironico_keycloak -p 9443:8443 -p 9000:9000 -p 9090:8080 \
#       --network=hironico-network
#        -e KC_BOOTSTRAP_ADMIN_USER=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=change_me \
#        hironico_keycloak \
#        start --optimized --hostname=hironico-keycloak