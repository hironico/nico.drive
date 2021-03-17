import fs from 'fs';
import { parseStringPromise } from 'xml2js';


export interface XMPElement {[key:string]: any}

class XMPLoader {
    buffer: ArrayBuffer = null;

    constructor(source: ArrayBuffer | Uint8Array | string) {
        if (source instanceof ArrayBuffer) {
            this.buffer = source;
        } else if (source instanceof Uint8Array) {
            this.buffer = source.buffer;
        } else if (typeof source === 'string') {
            this.loadFromFile(source);
        }
    }

    loadFromFile(filename: string): void {
        const filecontents: Buffer = fs.readFileSync(filename);
        this.buffer = filecontents.buffer;
    }

    find(): string {
        if (typeof this.buffer === 'undefined' || this.buffer === null) {
            console.log('Invalid buffer to find XMP tags.');
            return null;
        }

        const view = new DataView(this.buffer);

        if (view.getUint16(0, false) !== 0xFFD8) {
            console.warn("not valid JPEG");
            return null;
        }

        const startStr = "<x:xmpmeta",
            startStrLength = startStr.length,
            maxStart = this.buffer.byteLength - startStrLength,
            endStr = "x:xmpmeta>",
            endStrLength = endStr.length,
            maxEnd = this.buffer.byteLength - endStrLength;

        let start = 2,
            end = start + startStrLength,
            found = false;

        while (start < maxStart) {
            if (this.stringFromBuffer(view, start, startStrLength) == startStr) {
                found = true;
                break;
            } else {
                start++;
            }
        }

        if (!found) {
            console.warn("XMP not found");
            return null;
        }

        while (end < maxEnd) {
            if (this.stringFromBuffer(view, end, endStrLength) == endStr) {
                break;
            } else {
                end++;
            }
        }

        end += endStrLength;
        const result: string = this.stringFromBuffer(view, start, end - start);

        return result;
    }

    stringFromBuffer(buffer: DataView, start: number, length: number): string {
        let out = '';
        for (let i = start; i < start + length; i++) {
            out += String.fromCharCode(buffer.getUint8(i));
        }
        return out;
    }

    getParsedXMP(xmp: XMPElement): Promise<XMPElement> {
        return new Promise<{[key:string]: string}>((resolve, reject) => {
            if (typeof xmp === 'undefined' || xmp === null) {
                reject('Cannot parse null XMP data.');
                return;
            }

            const result: {[key:string]: string} = {};
            
            const xmpmeta = xmp['x:xmpmeta'];
            const description = xmpmeta['rdf:RDF'][0]['rdf:Description'][0];
            const descriptionList = description['$'];
            
            Object.keys(descriptionList).forEach(key => {
                if (!key.startsWith('crs:') && !key.startsWith('xmlns')) {
                    // console.log(`${key} => ${descriptionList[key]}`);
                    result[key] = descriptionList[key];
                }
            });

            const subjectsArray = description['dc:subject'][0]['rdf:Bag'][0]['rdf:li'];
            // console.log('dc:subject => ' + subjectsArray.join(','));
            result['tags'] = subjectsArray.join(',');

            resolve(result);
        });
    }

    parse(xmp: string, raw?: boolean): Promise<XMPElement> {
        if (!xmp) {
            xmp = this.find();
            if (!xmp) {
                return new Promise<XMPElement>((resolve, reject) => {                    
                    reject('No XMP information found in this file.');
                });
            }
        }

        const rawXMPPromise: Promise<XMPElement> = parseStringPromise(xmp);

        if (raw) {
            return rawXMPPromise;
        } else {
            return rawXMPPromise.then(value => {
                return this.getParsedXMP(value);
            });
        }
    }
}

export default XMPLoader;