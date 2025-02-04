// csvToJson.js
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Configuration des dossiers
const RESOURCE_DIR = '../resources';

// Configuration des catégories globales
const TAG_CATEGORIES = {
    'MEDIA_TYPE': [
        'news article',
        'investigative journalism',
        'article',
        'press release',
        'work'
    ],
    'LEGAL_ISSUES': [
        'smuggling',
        'erroneous provenance',
        'claim for restitution',
        'lawsuit'
    ],
    'INSTITUTIONS': [
        'museum',
        'gallery',
        'university',
        'auction house'
    ],
    'ACTORS': [
        'author',
        'publisher',
        'collector',
        'dealer'
    ]
};

function getGlobalCategory(tag) {
    if (!tag) return 'UNDEFINED';
    
    for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
        if (tags.some(t => tag.toLowerCase().includes(t.toLowerCase()))) {
            return category;
        }
    }
    return 'OTHER';
}

function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

function processCSV(inputFile, outputFile) {
    try {
        // S'assurer que le dossier resources existe
        const resourcePath = path.join(__dirname, RESOURCE_DIR);
        ensureDirectoryExists(resourcePath);

        // Chemins complets pour les fichiers
        const inputPath = path.join(resourcePath, inputFile);
        const outputPath = path.join(resourcePath, outputFile);

        // Vérifier que le fichier d'entrée existe
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Le fichier d'entrée ${inputPath} n'existe pas`);
        }

        // Lecture du fichier CSV
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        
        // Parse du CSV
        const parsedData = Papa.parse(fileContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        // Transformation des données
        const transformedData = parsedData.data.map(row => {
            const actors = [];
            if (row.publisher_Tag) actors.push({ type: 'publisher', name: row.publisher_Tag });
            if (row.author_Tag) actors.push({ type: 'author', name: row.author_Tag });

            return {
                id: row['Object URL'],
                title: row.Object,
                date: row['Date Publication'],
                mediaType: {
                    original: row.Tag,
                    category: getGlobalCategory(row.Tag)
                },
                subject: {
                    name: row.Subject_Tag,
                    category: getGlobalCategory(row.Subject_Tag)
                },
                depicts: {
                    name: row.depicts_Tag,
                    category: getGlobalCategory(row.depicts_Tag)
                },
                actors: actors,
                publication: {
                    name: row.published_in_Tag,
                    category: getGlobalCategory(row.published_in_Tag)
                }
            };
        });

        // Statistiques de base
        const stats = {
            totalEntries: transformedData.length,
            categoryCounts: {},
            subjectCategories: {}
        };

        transformedData.forEach(item => {
            // Compte les catégories principales
            const category = item.mediaType.category;
            stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1;

            // Compte les catégories de sujets
            const subjectCat = item.subject.category;
            stats.subjectCategories[subjectCat] = (stats.subjectCategories[subjectCat] || 0) + 1;
        });

        // Écriture du JSON
        const output = {
            metadata: {
                generatedAt: new Date().toISOString(),
                stats: stats
            },
            data: transformedData
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`Transformation terminée. Fichier sauvegardé : ${outputPath}`);
        console.log('\nStatistiques :', JSON.stringify(stats, null, 2));

    } catch (error) {
        console.error('Erreur lors de la transformation :', error);
    }
}

// Test du script
const inputFile = 'DATAVIZ.csv';
const outputFile = 'transformed_data.json';

processCSV(inputFile, outputFile);

module.exports = {
    processCSV,
    getGlobalCategory,
    TAG_CATEGORIES
};