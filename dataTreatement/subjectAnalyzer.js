const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const inputFile = path.join(RESOURCE_DIR, 'DATAVIZ.csv');

function analyzeSubjects() {
    try {
        const fileContent = fs.readFileSync(inputFile, 'utf8');
        const parsedData = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true
        });

        // Map pour stocker les objets associés à chaque subject
        const subjectToObjects = new Map();

        // Collecter tous les objets pour chaque subject
        parsedData.data.forEach(row => {
            if (row.Subject_Tag) {
                if (!subjectToObjects.has(row.Subject_Tag)) {
                    subjectToObjects.set(row.Subject_Tag, new Set());
                }
                subjectToObjects.get(row.Subject_Tag).add(row.Object);
            }
        });

        // Filtrer les subjects qui apparaissent dans plusieurs objets
        const multipleObjectSubjects = Array.from(subjectToObjects.entries())
            .filter(([, objects]) => objects.size > 1)
            .sort((a, b) => b[1].size - a[1].size);  // Trier par nombre d'objets décroissant

        if (multipleObjectSubjects.length > 0) {
            console.log("\nSujets apparaissant dans plusieurs objets :");
            console.log("=========================================");
            multipleObjectSubjects.forEach(([subject, objects]) => {
                console.log(`\n${subject} (${objects.size} objets) :`);
                Array.from(objects).sort().forEach((object, index) => {
                    console.log(`  ${index + 1}. ${object}`);
                });
            });
        }

        // Compter les sujets qui n'apparaissent que dans un objet
        const singleObjectSubjects = Array.from(subjectToObjects.entries())
            .filter(([, objects]) => objects.size === 1);

        console.log("\nStatistiques :");
        console.log("=============");
        console.log(`Nombre total de sujets uniques : ${subjectToObjects.size}`);
        console.log(`Sujets apparaissant dans plusieurs objets : ${multipleObjectSubjects.length}`);
        console.log(`Sujets apparaissant dans un seul objet : ${singleObjectSubjects.length}`);

    } catch (error) {
        console.error('Erreur :', error.message);
    }
}

analyzeSubjects();