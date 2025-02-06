const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const inputFile = path.join(RESOURCE_DIR, 'DATAVIZ.csv');

function analyzeObjectLines() {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const parsedData = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true
    });

    // Compter les lignes par objet
    const objectCounts = parsedData.data.reduce((acc, row) => {
        const object = row.Object;
        if (object) {
            acc[object] = (acc[object] || 0) + 1;
        }
        return acc;
    }, {});

    // Trier par nombre de lignes décroissant
    const sortedObjects = Object.entries(objectCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([object, count]) => ({object, count}));

    console.log("\nNombre de lignes par objet (ordre décroissant) :");
    console.log("=============================================");
    sortedObjects.forEach(({object, count}) => {
        console.log(`${count} lignes : ${object}`);
    });
    
    console.log("\nStatistiques :");
    console.log("-------------");
    console.log("Nombre total d'objets uniques:", sortedObjects.length);
    console.log("Nombre total de lignes:", sortedObjects.reduce((sum, {count}) => sum + count, 0));
    
    // Calculer quelques statistiques
    const counts = sortedObjects.map(o => o.count);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const avg = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    
    console.log("Minimum de lignes par objet:", min);
    console.log("Maximum de lignes par objet:", max);
    console.log("Moyenne de lignes par objet:", avg.toFixed(2));
}

if (require.main === module) {
    analyzeObjectLines();
}

module.exports = {
    analyzeObjectLines
};