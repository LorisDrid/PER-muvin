const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

async function analyzeModiglianiConnections() {
    const RESOURCE_DIR = path.join(process.cwd(), '../resources');

    function readCSV(filename) {
        console.log(`Reading ${filename}...`);
        const fileContent = fs.readFileSync(path.join(RESOURCE_DIR, filename), 'utf8');
        return Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true
        }).data;
    }

    // Lire les trois CSV
    const namesOfConcern = readCSV('NamesOfConcern.csv');
    const query261 = readCSV('query261.csv');
    const topicProv = readCSV('TopicProv.csv');

    // Créer des Sets pour une recherche rapide
    const namesOfConcernSet = new Set(namesOfConcern.map(row => 
        row.itemLabel?.toLowerCase() || ''));
    const query261Set = new Set(query261.map(row => 
        row.creatorLabel?.toLowerCase() || ''));

    // Grouper les entrées de TopicProv par article
    const articleGroups = {};
    topicProv.forEach(row => {
        if (!articleGroups[row.itemLabel]) {
            articleGroups[row.itemLabel] = {
                title: row.itemLabel,
                publicationDate: row.publication_date,
                url: row.full_work_available_at_URL,
                mainSubjects: [],
                depicts: [],
                authors: [],
                publishers: [],
                rawData: [] // Garder toutes les lignes brutes pour analyse
            };
        }

        // Ajouter la ligne brute
        articleGroups[row.itemLabel].rawData.push(row);

        // Ajouter les valeurs uniques
        if (row.main_subjectLabel && !articleGroups[row.itemLabel].mainSubjects.includes(row.main_subjectLabel)) {
            articleGroups[row.itemLabel].mainSubjects.push(row.main_subjectLabel);
        }
        if (row.depictsLabel && !articleGroups[row.itemLabel].depicts.includes(row.depictsLabel)) {
            articleGroups[row.itemLabel].depicts.push(row.depictsLabel);
        }
        if (row.authorLabel && !articleGroups[row.itemLabel].authors.includes(row.authorLabel)) {
            articleGroups[row.itemLabel].authors.push(row.authorLabel);
        }
        if (row.publisherLabel && !articleGroups[row.itemLabel].publishers.includes(row.publisherLabel)) {
            articleGroups[row.itemLabel].publishers.push(row.publisherLabel);
        }
    });

    // Trouver les articles liés à Modigliani
    const modiglianiArticles = {};
    Object.entries(articleGroups).forEach(([title, article]) => {
        const hasModigliani = 
            title.toLowerCase().includes('modigliani') ||
            article.mainSubjects.some(subject => 
                subject.toLowerCase().includes('modigliani')) ||
            article.depicts.some(depict => 
                depict.toLowerCase().includes('modigliani'));

        if (hasModigliani) {
            modiglianiArticles[title] = {
                ...article,
                connections: {
                    namesOfConcern: [],
                    query261: []
                }
            };

            // Chercher les connexions dans tous les noms liés à l'article
            const allNames = [
                ...article.mainSubjects,
                ...article.depicts,
                ...article.authors
            ];

            allNames.forEach(name => {
                if (!name) return;
                const nameLower = name.toLowerCase();
                
                // Chercher dans NamesOfConcern
                const nameOfConcernMatch = namesOfConcern.find(row => 
                    row.itemLabel?.toLowerCase() === nameLower);
                if (nameOfConcernMatch) {
                    modiglianiArticles[title].connections.namesOfConcern.push({
                        name: name,
                        foundIn: 'NamesOfConcern',
                        details: nameOfConcernMatch
                    });
                }

                // Chercher dans query261
                const query261Match = query261.find(row => 
                    row.creatorLabel?.toLowerCase() === nameLower);
                if (query261Match) {
                    modiglianiArticles[title].connections.query261.push({
                        name: name,
                        foundIn: 'query261',
                        details: query261Match
                    });
                }
            });

            // Supprimer les données brutes avant la sérialisation
            delete modiglianiArticles[title].rawData;
        }
    });

    // Afficher les résultats détaillés
    console.log('\n=== Articles liés à Modigliani avec leurs connections ===\n');
    Object.entries(modiglianiArticles).forEach(([title, article]) => {
        console.log(`\nArticle: ${title}`);
        console.log(`Date: ${article.publicationDate}`);
        console.log(`URL: ${article.url}`);
        
        if (article.mainSubjects.length > 0) {
            console.log('\nSujets principaux:');
            article.mainSubjects.forEach(subject => console.log(`- ${subject}`));
        }
        
        if (article.depicts.length > 0) {
            console.log('\nDépeint:');
            article.depicts.forEach(depict => console.log(`- ${depict}`));
        }

        if (article.authors.length > 0) {
            console.log('\nAuteurs:');
            article.authors.forEach(author => console.log(`- ${author}`));
        }

        console.log('\nConnexions trouvées:');
        if (article.connections.namesOfConcern.length > 0) {
            console.log('Dans NamesOfConcern:');
            article.connections.namesOfConcern.forEach(conn => 
                console.log(`- ${conn.name} (${conn.details?.itemDescription || 'No description'})`));
        }
        if (article.connections.query261.length > 0) {
            console.log('Dans query261:');
            article.connections.query261.forEach(conn => 
                console.log(`- ${conn.name} (${conn.details?.creatorDescription || 'No description'})`));
        }
        console.log('-'.repeat(50));
    });

    // Sauvegarder les résultats
    fs.writeFileSync(
        path.join(RESOURCE_DIR, 'modigliani_connections.json'),
        JSON.stringify(modiglianiArticles, null, 2)
    );
}

analyzeModiglianiConnections();