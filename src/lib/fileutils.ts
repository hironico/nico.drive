/**
 * General purpose file utilities
 */

// supported formats are : JPEG, PNG, WebP, AVIF, TIFF, GIF and SVG
// see doc at : https://sharp.pixelplumbing.com/
const supportedFormats: string[] = [ 'JPEG', 'JPG', 'PNG', 'WEBP', 'AVIF', 'TIFF', 'TIF', 'GIF', 'SVG', 'CR2', 'CR3', 'DNG'];

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

    return filename.toUpperCase().substring(index+1);
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
