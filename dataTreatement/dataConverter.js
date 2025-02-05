const fs = require('fs');
const path = require('path');

const RESOURCE_DIR = '../resources';

function convertToMuvinFormat(inputFile, outputFile) {
    try {
        // Configuration des chemins
        const resourcePath = path.join(__dirname, RESOURCE_DIR);
        const inputPath = path.join(resourcePath, inputFile);
        const outputPath = path.join(resourcePath, outputFile);

        // Lecture du fichier source
        const sourceData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        // Transformation des données
        const transformedData = {
            metadata: {
                generatedAt: new Date().toISOString()
            },
            data: sourceData.data.map((item, index) => {
                const baseArticle = {
                    id: item.id,
                    title: item.title,
                    date: item.date,
                    type: item.mediaType.category, // Pas besoin de .toLowerCase() ici
                    uri: {
                        type: "uri",
                        value: `article${index + 1}`
                    }
                };
        
                // Création des connections si subject et depicts sont présents
                if (item.subject?.name && item.depicts?.name) {
                    return {
                        ...baseArticle,
                        ego: {
                            type: "literal",
                            value: item.subject.name
                        },
                        alter: {
                            type: "literal",
                            value: item.depicts.name
                        }
                    };
                }
                // Si seulement subject est présent, l'utiliser comme ego et alter
                else if (item.subject?.name) {
                    return {
                        ...baseArticle,
                        ego: {
                            type: "literal",
                            value: item.subject.name
                        },
                        alter: {
                            type: "literal",
                            value: item.subject.name
                        }
                    };
                }
                // Si seulement depicts est présent, l'utiliser comme ego et alter
                else if (item.depicts?.name) {
                    return {
                        ...baseArticle,
                        ego: {
                            type: "literal",
                            value: item.depicts.name
                        },
                        alter: {
                            type: "literal",
                            value: item.depicts.name
                        }
                    };
                }
                return null;
            }).filter(item => item !== null) // Enlever les items sans ego/alter
        };

        // Écriture du fichier résultat
        fs.writeFileSync(outputPath, JSON.stringify(transformedData, null, 2));
        console.log(`Conversion terminée. Fichier sauvegardé : ${outputPath}`);

        // Quelques statistiques
        console.log('\nStatistiques :');
        console.log(`Nombre d'articles transformés : ${transformedData.data.length}`);
        
        // Compter les relations uniques
        const uniqueRelations = new Set();
        transformedData.data.forEach(item => {
            uniqueRelations.add(`${item.ego.value} -> ${item.alter.value}`);
        });
        console.log(`Nombre de relations uniques : ${uniqueRelations.size}`);

    } catch (error) {
        console.error('Erreur lors de la conversion :', error);
    }
}

// Exemple d'utilisation
if (require.main === module) {
    const inputFile = 'transformed_data.json';
    const outputFile = 'muvin_format.json';
    convertToMuvinFormat(inputFile, outputFile);
}

module.exports = {
    convertToMuvinFormat
};