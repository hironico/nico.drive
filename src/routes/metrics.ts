import * as client from "prom-client";
import express from "express";
import * as fs from "fs";
import path from "path";

const metricsRegister = new client.Registry();
client.collectDefaultMetrics({
    prefix: "nicodrive_",
    register: metricsRegister
});

// add a custom counter to get the number of files in the thumb cache
const thumbsCacheCounter = new client.Counter({
    name: 'nicodrive_thumbs_cache_file_count',
    help: 'Number of files in the thumbs cache directory',
    registers: [ metricsRegister ]
  });

const thumbsCacheSize = new client.Gauge({
    name: 'nicodrive_thumbs_cache_size_bytes',
    help: 'Size occupied in bytes by the cached thumbs files',
    registers: [ metricsRegister ]
});

const collectCustomMetrics = () => {
    const allThumbsFiles = fs.readdirSync(process.env.THUMBS_REPOSITORY_PATH, {withFileTypes: true});

    thumbsCacheCounter.reset();
    thumbsCacheCounter.inc(allThumbsFiles.length);

    let cacheSize = 0;
    allThumbsFiles.forEach(f => {
        const stat = fs.statSync(path.join(process.env.THUMBS_REPOSITORY_PATH, f.name));
        cacheSize += stat.size;
    });
    thumbsCacheSize.set(cacheSize);
}

const collect = async (req: express.Request, res: express.Response, next: express.NextFunction) => {

    // update custom metrics
    collectCustomMetrics();

    res.setHeader('Content-Type', metricsRegister.contentType);
    res.send(await metricsRegister.metrics());
}

export const register = (app: express.Application) : void => {
    app.get("/metrics", collect);
    console.log('Prometheus metrics endpoint activated.');
}