const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const inputFile = path.join(RESOURCE_DIR, 'DATAVIZ.csv');

function analyzeObjectsAndDates() {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const parsedData = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true
    });

    // Créer un Map pour stocker les combinaisons uniques objet+date
    const objectDateMap = new Map();

    parsedData.data.forEach(row => {
        if (row.Object && row['Date Publication']) {
            const key = `${row.Object}|||${row['Date Publication']}`;
            if (!objectDateMap.has(key)) {
                objectDateMap.set(key, {
                    object: row.Object,
                    date: row['Date Publication'],
                    count: 0
                });
            }
            objectDateMap.get(key).count++;
        }
    });

    // Trouver les objets qui apparaissent avec plusieurs dates
    const objectsWithMultipleDates = new Map();
    Array.from(objectDateMap.values()).forEach(({object, date}) => {
        if (!objectsWithMultipleDates.has(object)) {
            objectsWithMultipleDates.set(object, new Set());
        }
        objectsWithMultipleDates.get(object).add(date);
    });

    // Filtrer pour obtenir seulement les objets avec plusieurs dates
    const multiDateObjects = Array.from(objectsWithMultipleDates.entries())
        .filter(([, dates]) => dates.size > 1)
        .sort((a, b) => b[1].size - a[1].size);

    console.log("\nObjets apparaissant avec plusieurs dates :");
    console.log("========================================");
    multiDateObjects.forEach(([object, dates]) => {
        console.log(`\n${object}`);
        console.log("Dates :", Array.from(dates).sort());
        
        // Afficher le nombre de lignes pour chaque date
        Array.from(dates).sort().forEach(date => {
            const key = `${object}|||${date}`;
            const count = objectDateMap.get(key).count;
            console.log(`  ${date}: ${count} lignes`);
        });
    });

    console.log("\nStatistiques :");
    console.log("-------------");
    console.log("Nombre total d'objets uniques:", objectsWithMultipleDates.size);
    console.log("Nombre d'objets avec plusieurs dates:", multiDateObjects.length);
    console.log("Nombre total de combinaisons objet+date:", objectDateMap.size);
}

if (require.main === module) {
    analyzeObjectsAndDates();
}

module.exports = {
    analyzeObjectsAndDates
};