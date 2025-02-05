// csvToJson.js - Version simplifiée
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = '../resources';

// Types simplifiés
const CATEGORIES = {
    'media': ['article', 'news', 'press'],
    'artwork': ['painting', 'sculpture', 'artifact'],
    'institution': ['museum', 'gallery', 'university'],
    'person': ['artist', 'collector', 'dealer', 'curator']
};

function getCategory(tag) {
    if (!tag) return 'other';
    tag = tag.toLowerCase();
    
    for (const [category, keywords] of Object.entries(CATEGORIES)) {
        if (keywords.some(keyword => tag.includes(keyword))) {
            return category;
        }
    }
    return 'other';
}

function processCSV(inputFile, outputFile) {
    try {
        const resourcePath = path.join(__dirname, RESOURCE_DIR);
        const inputPath = path.join(resourcePath, inputFile);
        const outputPath = path.join(resourcePath, outputFile);

        if (!fs.existsSync(resourcePath)) {
            fs.mkdirSync(resourcePath, { recursive: true });
        }

        const fileContent = fs.readFileSync(inputPath, 'utf8');
        
        const parsedData = Papa.parse(fileContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        const transformedData = parsedData.data.map(row => ({
            id: row['Object URL'],
            title: row.Object,
            date: row['Date Publication'],
            mediaType: {
                category: getCategory(row.Tag)
            },
            subject: {
                name: row.Subject_Tag,
                category: getCategory(row.Subject_Tag)
            },
            depicts: {
                name: row.depicts_Tag,
                category: getCategory(row.depicts_Tag)
            }
        }));

        const output = {
            metadata: {
                generatedAt: new Date().toISOString(),
                count: transformedData.length
            },
            data: transformedData
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`Transformation terminée. Fichier sauvegardé : ${outputPath}`);

    } catch (error) {
        console.error('Erreur lors de la transformation :', error);
    }
}

if (require.main === module) {
    const inputFile = 'DATAVIZ.csv';
    const outputFile = 'transformed_data.json';
    processCSV(inputFile, outputFile);
}

module.exports = {
    processCSV,
    getCategory
};