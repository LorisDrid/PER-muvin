const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const inputFile = path.join(RESOURCE_DIR, 'DATAVIZ.csv');

function analyzeObjects() {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const parsedData = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true
    });

    // Extraire les objets uniques
    const uniqueObjects = new Set(parsedData.data
        .map(row => row.Object)
        .filter(Boolean)  // Enlever les valeurs null/undefined/empty
    );

    // Convertir en array et trier
    const sortedObjects = Array.from(uniqueObjects).sort();

    console.log("\nObjets uniques :");
    console.log("================");
    sortedObjects.forEach(object => {
        console.log(object);
    });
    console.log("\nNombre total d'objets uniques:", sortedObjects.length);
}

if (require.main === module) {
    analyzeObjects();
}

module.exports = {
    analyzeObjects
};