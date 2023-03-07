import crypto from 'crypto';
import fs from 'fs';

const md5 = (fileName: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        try {
            // créer un objet Hash avec l'algorithme md5
            const hash = crypto.createHash('md5');

            // créer un stream de lecture à partir du fichier
            const stream = fs.createReadStream(fileName);

            // écrire les données du stream dans le hash
            stream.pipe(hash);

            // quand le stream est terminé, lire le hash md5
            stream.on('end', function() {
                const md5 = hash.digest('hex');
                resolve(md5);
            });
        } catch(error) {
            reject(error);
        }
    });
};

export default md5;