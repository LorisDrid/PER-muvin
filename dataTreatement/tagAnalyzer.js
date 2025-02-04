const fs = require('fs');
const path = require('path');

const RESOURCE_DIR = '../resources';

function analyzeJSON(inputFile) {
    try {
        const resourcePath = path.join(__dirname, RESOURCE_DIR);
        const inputPath = path.join(resourcePath, inputFile);

        if (!fs.existsSync(inputPath)) {
            throw new Error(`Le fichier d'entrée ${inputPath} n'existe pas`);
        }

        const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        // Collecter tous les tags uniques par type
        const tagCollections = {
            mainTags: new Set(),
            subjectTags: new Set(),
            depictsTags: new Set(),
            actorTags: new Set(),
            publicationTags: new Set()
        };

        jsonData.data.forEach(item => {
            if (item.mediaType?.original) tagCollections.mainTags.add(item.mediaType.original);
            if (item.subject?.name) tagCollections.subjectTags.add(item.subject.name);
            if (item.depicts?.name) tagCollections.depictsTags.add(item.depicts.name);
            item.actors.forEach(actor => {
                if (actor.name) tagCollections.actorTags.add(actor.name);
            });
            if (item.publication?.name) tagCollections.publicationTags.add(item.publication.name);
        });

        // Générer le rapport détaillé
        const report = {
            mainTags: Array.from(tagCollections.mainTags).sort(),
            subjectTags: Array.from(tagCollections.subjectTags).sort(),
            depictsTags: Array.from(tagCollections.depictsTags).sort(),
            actorTags: Array.from(tagCollections.actorTags).sort(),
            publicationTags: Array.from(tagCollections.publicationTags).sort()
        };

        // Sauvegarder le rapport
        const outputPath = path.join(resourcePath, 'tags_analysis.json');
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        
        // Afficher un résumé
        console.log("Analyse des tags :");
        for (const [category, tags] of Object.entries(report)) {
            console.log(`\n${category}:`);
            console.log(`Nombre total: ${tags.length}`);
            console.log("Exemples:", tags.slice(0, 10));
        }

    } catch (error) {
        console.error('Erreur lors de l\'analyse :', error);
    }
}

// Exécuter l'analyse
analyzeJSON('transformed_data.json');