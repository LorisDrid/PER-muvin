// analyzeOther.js
const fs = require('fs');
const path = require('path');

const RESOURCE_DIR = '../resources';

function analyzeOtherCategories() {
    try {
        const resourcePath = path.join(__dirname, RESOURCE_DIR);
        const inputPath = path.join(resourcePath, 'recategorized_data.json');
        const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        // Collecter les entrées "OTHER"
        const otherEntries = {
            mediaType: [],
            subject: [],
            depicts: [],
            actors: [],
            publication: []
        };

        jsonData.data.forEach(item => {
            if (item.mediaType.detailedCategory.mainType === 'OTHER') {
                otherEntries.mediaType.push(item.mediaType.original);
            }
            if (item.subject.detailedCategory?.mainType === 'OTHER') {
                otherEntries.subject.push(item.subject.name);
            }
            if (item.depicts.detailedCategory?.mainType === 'OTHER') {
                otherEntries.depicts.push(item.depicts.name);
            }
            item.actors.forEach(actor => {
                if (actor.detailedCategory?.mainType === 'OTHER') {
                    otherEntries.actors.push(actor.name);
                }
            });
            if (item.publication.detailedCategory?.mainType === 'OTHER') {
                otherEntries.publication.push(item.publication.name);
            }
        });

        // Compter les occurrences uniques
        const uniqueCounts = {};
        for (const [category, entries] of Object.entries(otherEntries)) {
            const counts = entries.reduce((acc, curr) => {
                if (curr) {  // Ignorer les valeurs null/undefined
                    acc[curr] = (acc[curr] || 0) + 1;
                }
                return acc;
            }, {});

            // Trier par fréquence
            const sorted = Object.entries(counts)
                .sort(([,a],[,b]) => b-a)
                .reduce((acc, [key, value]) => {
                    acc[key] = value;
                    return acc;
                }, {});

            uniqueCounts[category] = sorted;
        }

        // Sauvegarder l'analyse
        const outputPath = path.join(resourcePath, 'other_categories_analysis.json');
        fs.writeFileSync(outputPath, JSON.stringify(uniqueCounts, null, 2));

        // Afficher un résumé
        console.log("Analyse des catégories 'OTHER':");
        for (const [category, counts] of Object.entries(uniqueCounts)) {
            console.log(`\n${category}:`);
            console.log('Nombre total d\'entrées uniques:', Object.keys(counts).length);
            console.log('Top 10 entrées les plus fréquentes:');
            Object.entries(counts)
                .slice(0, 10)
                .forEach(([item, count]) => {
                    console.log(`  "${item}": ${count} occurrences`);
                });
        }

    } catch (error) {
        console.error('Erreur lors de l\'analyse:', error);
    }
}

analyzeOtherCategories();