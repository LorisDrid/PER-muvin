const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const inputFile = path.join(RESOURCE_DIR, 'DATAVIZ.csv');

function analyzeObjectsSubjectsDepicts() {
    try {
        const fileContent = fs.readFileSync(inputFile, 'utf8');
        const parsedData = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true
        });

        // Map pour stocker les subjects et depicts uniques pour chaque objet
        const objectInfo = new Map();

        // Collecter tous les subjects et depicts pour chaque objet
        parsedData.data.forEach(row => {
            if (row.Object) {
                if (!objectInfo.has(row.Object)) {
                    objectInfo.set(row.Object, {
                        subjects: new Set(),
                        depicts: new Set()
                    });
                }
                
                if (row.Subject_Tag) objectInfo.get(row.Object).subjects.add(row.Subject_Tag);
                if (row.depicts_Tag) objectInfo.get(row.Object).depicts.add(row.depicts_Tag);
            }
        });

        // Convertir en array pour le tri
        const objectsWithCounts = Array.from(objectInfo.entries())
            .map(([object, info]) => ({
                object,
                subjectCount: info.subjects.size,
                depictsCount: info.depicts.size,
                totalCount: info.subjects.size + info.depicts.size,
                subjects: Array.from(info.subjects).sort(),
                depicts: Array.from(info.depicts).sort()
            }))
            .sort((a, b) => b.totalCount - a.totalCount);  // Tri par nombre total décroissant

        console.log("\nObjets classés par nombre total de subjects + depicts :");
        console.log("=================================================");
        objectsWithCounts.forEach(({object, subjectCount, depictsCount, totalCount, subjects, depicts}) => {
            console.log(`\n${object} (Total: ${totalCount} - ${subjectCount} subjects, ${depictsCount} depicts):`);
            if (subjects.length > 0) {
                console.log("\n  Subjects:");
                subjects.forEach((subject, index) => {
                    console.log(`    ${index + 1}. ${subject}`);
                });
            }
            if (depicts.length > 0) {
                console.log("\n  Depicts:");
                depicts.forEach((depict, index) => {
                    console.log(`    ${index + 1}. ${depict}`);
                });
            }
        });

        // Statistiques
        const totalObjects = objectsWithCounts.length;
        const totalSubjects = objectsWithCounts.reduce((sum, obj) => sum + obj.subjectCount, 0);
        const totalDepicts = objectsWithCounts.reduce((sum, obj) => sum + obj.depictsCount, 0);
        const averageSubjects = totalSubjects / totalObjects;
        const averageDepicts = totalDepicts / totalObjects;

        console.log("\nStatistiques :");
        console.log("=============");
        console.log(`Nombre total d'objets : ${totalObjects}`);
        console.log("\nSubjects :");
        console.log(`- Nombre total de relations objet-subject : ${totalSubjects}`);
        console.log(`- Moyenne de subjects par objet : ${averageSubjects.toFixed(2)}`);
        console.log(`- Maximum de subjects pour un objet : ${Math.max(...objectsWithCounts.map(o => o.subjectCount))}`);
        console.log(`- Minimum de subjects pour un objet : ${Math.min(...objectsWithCounts.map(o => o.subjectCount))}`);
        console.log("\nDepicts :");
        console.log(`- Nombre total de relations objet-depicts : ${totalDepicts}`);
        console.log(`- Moyenne de depicts par objet : ${averageDepicts.toFixed(2)}`);
        console.log(`- Maximum de depicts pour un objet : ${Math.max(...objectsWithCounts.map(o => o.depictsCount))}`);
        console.log(`- Minimum de depicts pour un objet : ${Math.min(...objectsWithCounts.map(o => o.depictsCount))}`);

    } catch (error) {
        console.error('Erreur :', error.message);
    }
}

analyzeObjectsSubjectsDepicts();