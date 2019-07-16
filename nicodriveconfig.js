var nicodriveconfig = module.exports = {
    rootDir: "./data",
    locksdir: "./data",
    auth: {
        digestFile: "htdigest",
        realm: "synobackup"
    },
    ssl: {
        keyFile: './ssl/server.key',
        certFile: './ssl/server.crt'
    },
    frontend: {
        port: 5500
    }
};