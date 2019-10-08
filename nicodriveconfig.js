var nicodriveconfig = module.exports = {
    rootDir: "/home/hironico/source/nico.drive/data",
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