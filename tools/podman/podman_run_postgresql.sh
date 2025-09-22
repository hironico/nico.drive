#! /bin/bash 

podman run --name postgresql -p 5432:5432 --expose 5432 \
        --network hironico-network \
        --hostname hironico-postgresql \
        -v pgdata-17:/var/lib/postgresql/data \
        -e PGDATA=/var/lib/postgresql/data \
        -e POSTGRES_PASSWORD=BLAbla123_postgres \
        docker.io/library/postgres \
        postgres
