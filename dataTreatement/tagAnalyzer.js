const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const inputFile = path.join(RESOURCE_DIR, 'DATAVIZ.csv');

function analyzeTagsPerObject() {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const parsedData = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true
    });

    // Créer d'abord un map des tags par objet
    const objectTags = new Map();
    
    parsedData.data.forEach(row => {
        if (row.Object && row.Tag) {
            if (!objectTags.has(row.Object)) {
                objectTags.set(row.Object, new Set());
            }
            objectTags.get(row.Object).add(row.Tag);
        }
    });

    // Maintenant compter les occurrences uniques de chaque tag
    const tagCounts = {};
    objectTags.forEach(tags => {
        tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // Trier par fréquence décroissante
    const sortedTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([tag, count]) => ({tag, count}));

    console.log("\nAnalyse des tags (une occurrence par objet) :");
    console.log("=========================================");
    sortedTags.forEach(({tag, count}) => {
        console.log(`${tag}: ${count} objets`);
    });
    console.log("\nNombre total de tags uniques:", sortedTags.length);
    console.log("Nombre total d'objets:", objectTags.size);
}

if (require.main === module) {
    analyzeTagsPerObject();
}

module.exports = {
    analyzeTagsPerObject
};