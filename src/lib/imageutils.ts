/**
 * Image related functions for thumb generation and manipulation
 */

import fspromise from "fs/promises";
import { createWriteStream as fsCreateWriteStream, StatSyncOptions, unlinkSync } from "fs";
import child_process, { SpawnSyncOptions } from 'child_process';
import os from "os";
import { constants, writeFileSync, statSync } from "fs";
import { isHeicFile, isRawFile, md5 } from "./fileutils";
import sharp from "sharp";
import convert from 'heic-convert';

export type ThumbRequest = {
    fullFilename: string;
    width: number;
    height: number;
    resizeFit: keyof sharp.FitEnum;
}

export const getCachedImageFilename = (sourceFilename: string, width: string, height: string, resizeFit: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        md5(sourceFilename)
            .then(md5Sum => {
                resolve(`${process.env.THUMBS_REPOSITORY_PATH}/${md5Sum}_${width}x${height}-${resizeFit}`);
            }).catch(error => reject(error));
    });
}

export const checkFileExists = (filename: string): boolean => {
    const statsOps: StatSyncOptions = {
        bigint: false,
        throwIfNoEntry: false
    }
    const lockStats = statSync(filename, statsOps);
    return (typeof lockStats !== 'undefined');
}

export const checkThumbLock = (outputFilename: string): boolean => {
    const lockFilename = `${outputFilename.split('_')[0]}.lock`;
    if (!checkFileExists(lockFilename)) {
        console.log(`Putting lock file: ${lockFilename}.`);
        writeFileSync(lockFilename, `${outputFilename} lock file`);
        return true;
    } else {
        return false;
    }
}

export const removeThumbLock = (outputFilename: string): boolean => {
    if (outputFilename === void 0 || outputFilename === null) {
        return true;
    }
    const lockFilename = `${outputFilename.split('_')[0]}.lock`;
    const statsOps: StatSyncOptions = {
        bigint: false,
        throwIfNoEntry: false
    }
    const lockStats = statSync(lockFilename, statsOps);
    if (typeof lockStats !== 'undefined') {
        console.log(`Removing lock file: ${lockFilename}`);
        unlinkSync(lockFilename);
    }

    return true;
}

export const generateAndSaveThumb = (input: string, width: number, height: number, resizeFit: keyof sharp.FitEnum): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        if (!checkFileExists(input)) {
            console.log(`Received a thumb request for invalid file name: ${input}`);
            return new Promise<string>((accpet, reject) => {
                reject(`Received a thumb request for invalid file name: ${input}`);
            });
        }

        let outFilename: string = null;
        getCachedImageFilename(input, width.toString(), height.toString(), resizeFit)
            .then(outputFilename => {
                if (checkFileExists(outputFilename)) {
                    console.log('Thumb already exists: ' + outputFilename);
                    resolve(outputFilename);
                } else {
                    outFilename = outputFilename;
                    return generateAndSaveFileThumb(input, width, height, resizeFit, outputFilename);
                }
            }).then(outputFilename => resolve(outputFilename))
            .catch(error => reject(error))
            .finally(() => removeThumbLock(outFilename));
    });
}

export const generateAndSaveFileThumb = (input: string, width: number, height: number, resizeFit: keyof sharp.FitEnum, outputFilename: string): Promise<string> => {
    if (checkThumbLock(outputFilename)) {
        if (isRawFile(input)) {
            return generateAndSaveRawThumb(input, width, height, resizeFit, outputFilename);
        } else if (isHeicFile(input)) {
            return generateAndSaveHeicThumb(input, width, height, resizeFit, outputFilename);
        } else {
            return generateAndSaveImageThumb(input, width, height, resizeFit, outputFilename);
        }
    } else {
        return new Promise<string>((resolve, reject) => {
            const err = new Error(`${outputFilename} is already being generated.`);
            err.name = 'LOCKED';
            reject(err);
        });
    }
}

export const generateAndSaveImageThumb = (input: string | Buffer, width: number, height: number, resizeFit: keyof sharp.FitEnum, outputFilename: string): Promise<string> => {
    console.log('Generate and save image thumb from: ' + input + ' to ' + outputFilename);
    return new Promise<string>((resolve, reject) => {
        sharp(input)
            .resize({
                width: width,
                height: height,
                fit: resizeFit,
                position: sharp.strategy.entropy
            })
            .jpeg()
            .toFile(outputFilename)
            .then(_ => resolve(outputFilename)) // eslint-disable-line @typescript-eslint/no-unused-vars
            .catch(error => reject(error));
    });

}

export const generateAndSaveRawThumb = (inputFilename: string, width: number, height: number, resizeFit: keyof sharp.FitEnum, outputFilename: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        getCachedImageFilename(inputFilename, 'full', 'full', 'none')
            .then(rawFullThumbFilename => generateAndSaveImageFromRaw(inputFilename, rawFullThumbFilename))
            .then(rawFullThumbFilename => generateAndSaveImageThumb(rawFullThumbFilename, width, height, resizeFit, outputFilename))
            .then(_ => resolve(outputFilename))  // eslint-disable-line @typescript-eslint/no-unused-vars
            .catch(error => reject(error));
    });
}

export const generateAndSaveImageFromRaw = (inputFilename: string, targetFilename: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        if (!isRawFile(inputFilename)) {
            reject(`Cannot generate a raw file thumb from a non raw file: ${inputFilename}`);
            return;
        }

        let toolsPath = null;
        switch (os.platform()) {
            case 'linux':
                toolsPath = './tools/dcraw_emu_linux';
                process.env.LD_LIBRARY_PATH = `${process.env.LD_LIBRARY_PATH}:./tools/.`;
                break;

            case 'win32':
                toolsPath = './tools/dcraw_emu.exe';
                process.env.PATH = `${process.env.PATH};./tools/.`;
                break;

            case 'darwin':
                toolsPath = './tools/dcraw_emu_macos';
                process.env.LD_LIBRARY_PATH = `${process.env.LD_LIBRARY_PATH}:./tools/.`;
                break;

            default:
                reject(`Not supported platform for embbeded dcraw emu from LibRaw: ${os.platform()}`);
                return;
        }

        const dcrawPath = process.env.DCRAW_PATH ? process.env.DCRAW_PATH : toolsPath;

        const options: SpawnSyncOptions = {
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 1024 * 1024 * 1024, // ONE GIGA BYTES
            env: process.env
        }

        fspromise.access(dcrawPath, constants.X_OK)
            .then(() => {
                const dcraw = child_process.spawn(dcrawPath, ["-T", "+M", "-o", "2", "-h", "-Z", "-", inputFilename], options);
                const stdErr = '';
                const writeStream = fsCreateWriteStream(targetFilename);
                dcraw.stdout.pipe(writeStream);
                dcraw.on('close', (exitCode) => {
                    if (exitCode !== 0) {
                        const errMsg = `Error while generating raw file thumb image: ${stdErr}`;
                        console.error(errMsg);
                        reject(errMsg);
                    } else {
                        resolve(targetFilename);
                    }

                    writeStream.close();
                });
            }).catch(error => {
                const msg = `dcraw program not found or not executable: ${dcrawPath}. Skipping thumb generation for RAW image file.\n${JSON.stringify(error)}`;
                console.error(msg);
                reject(msg);
            });
    });    
}

export const generateAndSaveHeicThumb = (inputFilename: string, width: number, height: number, resizeFit: keyof sharp.FitEnum, outputFilename: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        getCachedImageFilename(inputFilename, 'full', 'full', 'none')
            .then(heicFullThumbFilename => generateAndSaveImageFromHeic(inputFilename, heicFullThumbFilename))
            .then(heicFullThumbFilename => generateAndSaveImageThumb(heicFullThumbFilename, width, height, resizeFit, outputFilename))
            .then(_ => resolve(outputFilename))  // eslint-disable-line @typescript-eslint/no-unused-vars
            .catch(error => reject(error));
    });
}

export const generateAndSaveImageFromHeic = (inputFilename: string, targetFilename: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        if (!isHeicFile(inputFilename)) {
            reject(`Cannot generate a raw file thumb from a non HEIC file: ${inputFilename}`);
            return;
        }

        fspromise.readFile(inputFilename)
        .then(inputBuffer => {
            return convert({
                buffer: inputBuffer.buffer.slice(inputBuffer.byteOffset, inputBuffer.byteOffset + inputBuffer.byteLength),
                format: 'JPEG',
                quality: 8
            })
        }).then(outputBuffer => {            
            return fspromise.writeFile(targetFilename, new Uint8Array(outputBuffer));
        }).then(() => resolve(targetFilename))
        .catch(error => reject(error));
    });
}
