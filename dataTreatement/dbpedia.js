const fs = require('fs');
const Papa = require('papaparse');
const fetch = require('node-fetch');
const path = require('path');

// Configuration
const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    BATCH_SIZE: 5,
    BATCH_DELAY: 5000,
    TEST_LIMIT: 10
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function spotlightAnnotateWithRetry(text, retryCount = 0) {
    const apiUrl = 'https://api.dbpedia-spotlight.org/en/annotate';
    const params = new URLSearchParams({
        text: text,
        confidence: 0.2,
        support: 5
    });

    try {
        const response = await fetch(`${apiUrl}?${params}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.status === 400) {
            throw new Error('Bad Request - Text might be too long or contain invalid characters');
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (retryCount < CONFIG.MAX_RETRIES && error.message.includes('HTTP error')) {
            console.log(`Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} after error: ${error.message}`);
            await sleep(CONFIG.RETRY_DELAY);
            return spotlightAnnotateWithRetry(text, retryCount + 1);
        }
        console.error(`Error annotating text: ${error.message}`);
        return null;
    }
}

const extractPersonsAndInstitutions = (text) => {
    const persons = new Set();
    const institutions = new Set();
    
    // Patterns pour détecter les noms
    const personPatterns = [
        // Noms avec titres
        /\b(Dr\.|Duke|Prince|Baron|Count|Mr\.|Mrs\.|Ms\.|Prof\.)\s+([A-Z][a-zÀ-ÿ\-]+(?:\s+[A-Z][a-zÀ-ÿ\-]+)*)\b/g,
        // Noms composés standards avec particules optionnelles
        /\b[A-Z][a-zÀ-ÿ\-]+(?:\s+(?:von|van|de|du|der|den|zum|zur|am|auf|zum|zur)\s+)?[A-Z][a-zÀ-ÿ\-]+\b/g
    ];

    const institutionPatterns = [
        /\b[A-Z][a-zA-Z\s]*(Museum|Gallery|Palace|Castle)\b/g,
        /\bKunsthaus\s+[A-Z][a-zA-Z\s]*/g
    ];

    const wordsToExclude = ['Collection', 'Museum', 'Palace', 'Castle', 'March', 'Gallery', 'between', 'Sold'];

    // Extraire les institutions d'abord
    let institutions_found = [];
    institutionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            institutions_found.push(match[0].trim());
            institutions.add({
                name: match[0].trim(),
                type: 'institution'
            });
        }
    });

    // Ensuite extraire les personnes
    personPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            let name = match[0];
            
            // Vérifier si ce nom n'est pas déjà détecté comme institution
            if (!institutions_found.some(inst => inst.includes(name)) && 
                !wordsToExclude.some(word => name.startsWith(word))) {
                persons.add({
                    name: name,
                    type: 'person'
                });
            }
        }
    });

    // Traiter spécifiquement les Collections
    const collectionPattern = /\bCollection\s+([A-Z][a-zÀ-ÿ\-]+(?:\s+[A-Z][a-zÀ-ÿ\-]+)*)/g;
    let match;
    while ((match = collectionPattern.exec(text)) !== null) {
        const collectionName = match[0];
        const personName = match[1];
        
        // Ajouter la collection comme institution
        institutions.add({
            name: collectionName.trim(),
            type: 'institution'
        });
        
        // Ajouter le nom comme personne s'il n'est pas dans la liste d'exclusion
        if (!wordsToExclude.some(word => personName.startsWith(word))) {
            persons.add({
                name: personName.trim(),
                type: 'person'
            });
        }
    }

    return {
        persons: Array.from(persons),
        institutions: Array.from(institutions)
    };
};

const extractYears = (text) => {
    const yearPattern = /\b(1[89]\d{2}|20[0-2]\d)\b/g;
    return [...new Set(text.match(yearPattern) || [])];
};

const identifyTransactions = (text) => {
    const patterns = {
        settlement: /\b(settlement|agreement|arrangement)\b/i,
        confiscation: /\b(confiscation|confiscated|seized)\b/i,
        sale: /\b(sold|sale|purchased|acquired)\b/i,
        loss: /\b(loss|lost|disappeared)\b/i,
        restitution: /\b(restitution|returned|restored)\b/i
    };

    return Object.entries(patterns)
        .filter(([_, pattern]) => pattern.test(text))
        .map(([type]) => type);
};

async function processProvenance() {
    try {
        const RESOURCE_DIR = path.join(process.cwd(), '../resources');
        const inputFile = path.join(RESOURCE_DIR, 'Restitution.csv');
        const fileContent = fs.readFileSync(inputFile, 'utf8');
        
        const parsedData = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true
        });

        console.log(`Processing first ${CONFIG.TEST_LIMIT} entries out of ${parsedData.data.length}...`);
        
        const results = [];
        for (let i = 0; i < Math.min(CONFIG.TEST_LIMIT, parsedData.data.length); i++) {
            const row = parsedData.data[i];
            
            const cleanedText = row.Provenance
                .replace(/;Read more;Read less/g, '')
                .replace(/;Read more/, '')
                .replace(/;Read less/, '')
                .trim();

            console.log(`\nProcessing entry ${i + 1}:`);
            console.log('Title:', row.Title);
            console.log('Text:', cleanedText);

            // Extraire les personnes et institutions
            const { persons, institutions } = extractPersonsAndInstitutions(cleanedText);
            const years = extractYears(cleanedText);
            const transactions = identifyTransactions(cleanedText);

            // Appeler DBpedia Spotlight pour les lieux
            let places = [];
            if (cleanedText.length > 0) {
                const annotations = await spotlightAnnotateWithRetry(cleanedText);
                if (annotations?.Resources) {
                    places = annotations.Resources
                        .filter(resource => 
                            resource['@types'].includes('DBpedia:City') || 
                            resource['@types'].includes('DBpedia:Country'))
                        .map(resource => ({
                            name: resource['@surfaceForm'],
                            type: 'place',
                            dbpediaTypes: resource['@types']
                        }));
                }
            }

            // Afficher les résultats pour vérification
            console.log('Detected persons:', persons);
            console.log('Detected institutions:', institutions);
            console.log('Detected places:', places);
            console.log('Detected years:', years);
            console.log('Detected transactions:', transactions);

            results.push({
                id: i + 1,
                title: row.Title,
                originalText: cleanedText,
                persons,
                institutions,
                places,
                years,
                transactions
            });

            if ((i + 1) % CONFIG.BATCH_SIZE === 0) {
                await sleep(CONFIG.BATCH_DELAY);
            }
        }

        const outputFile = path.join(RESOURCE_DIR, 'restitution_analysis.json');
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`\nAnalysis complete. Results saved to ${outputFile}`);

    } catch (error) {
        console.error('Error during processing:', error);
    }
}

processProvenance();