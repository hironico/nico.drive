/**
 * General purpose file utilities
 */

import crypto from 'crypto';
import { accessSync, constants, createReadStream as fsCreateReadStream, readdirSync, statSync } from "fs";
import { join } from 'path';

// supported formats are : JPEG, PNG, WebP, AVIF, TIFF, GIF and SVG
// see doc at : https://sharp.pixelplumbing.com/
const supportedFormats: string[] = ['JPEG', 'JPG', 'PNG', 'WEBP', 'AVIF', 'TIFF', 'TIF', 'GIF', 'SVG', 'CR2', 'CR3', 'DNG'];

export const getFileExtention = (filename: string): string => {
    if (typeof filename === 'undefined' || filename === null) {
        return null;
    }

    if (filename.startsWith('.')) {
        return null;
    }

    const index = filename.lastIndexOf('.');
    if (index < 0) {
        return null;
    }

    return filename.toUpperCase().substring(index + 1);
}

export const isRawFile = (filename: string): boolean => {
    const extention = getFileExtention(filename);
    if (extention === null) {
        return false;
    }

    const regexp = new RegExp(/CR[0-9]/);
    return regexp.test(extention);
}

export const isFileSupported = (filename: string): boolean => {
    const extention = getFileExtention(filename);
    if (extention === null) {
        return false;
    }

    const formatIndex = supportedFormats.indexOf(extention);
    return formatIndex !== -1;
}

export const md5 = (fileName: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        try {
            // créer un objet Hash avec l'algorithme md5
            const hash = crypto.createHash('md5');

            // créer un stream de lecture à partir du fichier
            const stream = fsCreateReadStream(fileName);
            if (stream === null || typeof stream === 'undefined') {
                reject(`Cannot read file for md5 compute: ${fileName}`);
                return;
            }

            // écrire les données du stream dans le hash
            stream.pipe(hash);

            // quand le stream est terminé, lire le hash md5
            stream.on('end', function () {
                try {
                    const md5 = hash.digest('hex');
                    resolve(md5);
                } catch (error) {
                    reject(error)
                }
            });
        } catch (error) {
            console.log(`Cannot compute md5`);
            reject(error);
        }
    });
};

/**
 * Computes the total of space used by a given directory name
 * @param dir the name of the directory to get the total size recursively
 * @returns Promise<number> containing the total of space used in bytes.
 */
export const dirSize = (dir: string): number => {
    try {
        accessSync(dir, constants.R_OK | constants.X_OK);
    } catch (error) {
        console.error(`Cannot compute directory size for ${dir}. Access denied. Total size will be incorrect.`);
        return 0;
    }

    try {
        const files = readdirSync(dir, { withFileTypes: true });

        const paths = files.map(file => {
            const path = join(dir, file.name);
            if (file.isDirectory()) {
                return dirSize(path);
            }

            if (file.isFile()) {
                const { size } = statSync(path);
                return size;
            }

            console.warn('Folder entry type is not a directory nor a file');
            return 0;
        });

        return paths.reduce((i, size) => i + size, 0);
    } catch (error) {
        console.log(`Cannot read the directory: ${dir}. ${error}`);
        return 0;
    }
}

/**
 * Count the number of elements in a given directory. This function is not recursive.
 * @param dir the directory to count elements from 
 * @returns number of files and folders in the directory.
 */
export const dirElementsCount = (dir: string): number => {
    const entries = readdirSync(dir);
    return entries.length;
}
