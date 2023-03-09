/**
 * Image related functions for thumb generation and manipulation
 */

import sharp, { OutputInfo } from "sharp";
import fspromise from "fs/promises";
import { createWriteStream as fsCreateWriteStream } from "fs";
import child_process, { SpawnSyncOptions } from 'child_process';
import { constants } from "fs";
import { isRawFile, md5 } from "./fileutils";

export const getCachedImageFilename = (sourceFilename : string, width: string, height: string, resizeFit: string): Promise<string> => {
    return new Promise<string>( (resolve, reject) => {
       md5(sourceFilename)
       .then(md5Sum => {
           resolve(`${process.env.THUMBS_REPOSITORY_PATH}/${md5Sum}_${width}x${height}-${resizeFit}`);
       }).catch(error => reject(error));
    }); 
}

export const generateAndSaveThumb = (input: string, width: number, height: number, resizeFit: keyof sharp.FitEnum) : Promise<OutputInfo> => {
   return new Promise<OutputInfo>((resolve, reject) => {
       getCachedImageFilename(input, width.toString(), height.toString(), resizeFit)
       .then(outputFilename => {
           const promise = isRawFile(input) 
                           ? generateAndSaveRawThumb(input, width, height, resizeFit, outputFilename)
                           : generateAndSaveImageThumb(input, width, height, resizeFit, outputFilename);
           promise.then(info => resolve(info)).catch(error => reject(error));
       })
       .catch(error => reject(error));
   });
}

export const generateAndSaveImageThumb = (input: string | Buffer, width: number, height: number, resizeFit: keyof sharp.FitEnum, outputFilename: string) : Promise<OutputInfo> => {
   return new Promise<OutputInfo>((resolve, reject) => {
       try {
           sharp(input)
           .resize({
               width: width,
               height: height,
               fit: resizeFit,
               position: sharp.strategy.entropy
           })
           .jpeg()
           .toFile(outputFilename)            
           .then(outputInfo => {
               resolve(outputInfo);
           })
           .catch(reason => {
               const errMsg = `Error while writing the thumb jpeg cahced file to disk: ${reason}`;
               console.log(errMsg);
               reject(errMsg);
           });
       } catch (error) {
           reject(error);
       }
   });
}

export const generateAndSaveRawThumb = (inputFilename: string, width: number, height: number, resizeFit: keyof sharp.FitEnum, outputFilename: string) : Promise<OutputInfo> => {
   return new Promise<OutputInfo>((resolve, reject) => {
       getCachedImageFilename(inputFilename, 'full', 'full', 'none')
       .then(rawFullThumbFilename => {
           generateAndSaveImageFromRaw(inputFilename, rawFullThumbFilename)
           .then(() => {
               generateAndSaveImageThumb(rawFullThumbFilename, width, height, resizeFit, outputFilename)
               .then(outputInfo => {
                   resolve(outputInfo);
               });        
           })
       })
       .catch(error => {
           reject(error);
       });
   });
}

export const generateAndSaveImageFromRaw = (inputFilename: string, targetFilename: string) : Promise<void> => {
   return new Promise<void>((resolve, reject) => {
       if (!isRawFile(inputFilename)) {
           reject(`Cannot generate a raw file thumb from a non raw file: ${inputFilename}`);
           return;
       }

       const dcrawPath = process.env.DCRAW_PATH ? process.env.DCRAW_PATH : `./tools/dcraw_emu`;
       process.env.LD_LIBRARY_PATH = './tools/.';
       const options: SpawnSyncOptions = {
           stdio: ['pipe', 'pipe', 'pipe'],
           maxBuffer: 1024 * 1024 * 1024, // ONE GIGA BYTES
           env: process.env
       }

       fspromise.access(dcrawPath, constants.X_OK)
       .then(() => {
           const dcraw = child_process.spawn(dcrawPath, [ "-T", "+M", "-o", "2", "-h", "-Z", "-", inputFilename], options);
           const stdErr = '';
           const writeStream = fsCreateWriteStream(targetFilename);
           dcraw.stdout.pipe(writeStream);
           dcraw.on('close', (exitCode) => {
               if (exitCode !== 0) {
                   const errMsg = `Error while generating raw file thumb image: ${stdErr}`;
                   console.error(errMsg);
                   reject(errMsg);
               } else {
                   resolve();
               }

               writeStream.close();
           });
       }).catch(error => {
           const msg = `dcraw program not found or not executable: ${dcrawPath}. Skipping thumb generation for RAW image file.\n${JSON.stringify(error)}`;
           console.log(msg);
           reject(msg);
       });
   });
}
