var nicodriveconfig = module.exports = {
    rootDir: "/data/synobackup/files",
    locksdir: "/data/synobackup/files",
    auth: {
        digestFile: "./htdigest",
        realm: "synobackup"
    },
    ssl: {
        keyFile: './ssl/server.key',
        certFile: './ssl/server.crt'
    }
};