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
            console.log('Bad Request for text:', text);
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

function findDates(text) {
    const datePatterns = [
        {
            regex: /\b(19|20)\d{2}[-\/](19|20)\d{2}(?:\/?(19|20)\d{2})?\b/g,
            type: 'range',
            extract: (match) => {
                const [start, end] = match[0].split(/[-\/]/);
                return {
                    startYear: parseInt(start),
                    endYear: parseInt(end),
                    position: match.index
                };
            }
        },
        {
            regex: /until\s+(19|20)\d{2}/g,
            type: 'until',
            extract: (match) => ({
                endYear: parseInt(match[0].match(/\d{4}/)[0]),
                position: match.index
            })
        },
        {
            regex: /between\s+(19|20)\d{2}\s+and\s+(19|20)\d{2}/g,
            type: 'between',
            extract: (match) => {
                const years = match[0].match(/\d{4}/g);
                return {
                    startYear: parseInt(years[0]),
                    endYear: parseInt(years[1]),
                    position: match.index
                };
            }
        },
        {
            regex: /\b(19|20)\d{2}\s+(?:confiscation|restitution|settlement|agreement|sale|auction|loss)\b/gi,
            type: 'event',
            extract: (match) => ({
                year: parseInt(match[0].match(/\d{4}/)[0]),
                event: match[0].match(/(?:confiscation|restitution|settlement|agreement|sale|auction|loss)/i)[0].toLowerCase(),
                position: match.index
            })
        },
        {
            regex: /\b(19|20)\d{2}\b/g,
            type: 'single',
            extract: (match) => ({
                year: parseInt(match[0]),
                position: match.index
            })
        }
    ];

    const dates = [];
    datePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
            const extractedDate = pattern.extract(match);
            dates.push({
                ...extractedDate,
                type: pattern.type,
                originalText: match[0],
                context: text.substring(
                    Math.max(0, match.index - 50),
                    Math.min(text.length, match.index + match[0].length + 50)
                ).trim()
            });
        }
    });

    return dates.sort((a, b) => {
        const yearA = a.startYear || a.year || a.endYear;
        const yearB = b.startYear || b.year || b.endYear;
        return yearA - yearB;
    });
}

function associateEntitiesWithDates(text, entities, dates) {
    const associations = [];

    dates.forEach(date => {
        const contextStart = Math.max(0, date.position - 100);
        const contextEnd = Math.min(text.length, date.position + 100);
        const dateContext = text.substring(contextStart, contextEnd);

        // Trouver les entités dans le contexte de la date
        const relevantEntities = entities.filter(entity => {
            return dateContext.toLowerCase().includes(entity['@surfaceForm'].toLowerCase());
        });

        associations.push({
            date: {
                startYear: date.startYear,
                endYear: date.endYear,
                year: date.year,
                type: date.type,
                event: date.event,
                originalText: date.originalText
            },
            entities: relevantEntities.map(entity => ({
                name: entity['@surfaceForm'],
                uri: entity['@URI'],
                types: entity['@types'].split(','),
                confidence: entity['@similarityScore']
            })),
            context: date.context
        });
    });

    return associations;
}

async function analyzeProvenance() {
    try {
        const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
        const inputFile = path.join(RESOURCE_DIR, 'Restitution.csv');
        const fileContent = fs.readFileSync(inputFile, 'utf8');
        
        const results = [];
        let processedCount = 0;

        const parsedData = Papa.parse(fileContent, { header: true }).data;
        
        for (const row of parsedData.slice(0, CONFIG.TEST_LIMIT)) {
            if (!row.Provenance) continue;

            console.log(`\nProcessing entry ${processedCount + 1}`);
            console.log('Title:', row.Title);
            
            const provenance = row.Provenance
                .replace(/;Read more;Read less/g, '')
                .replace(/;Read more/, '')
                .replace(/;Read less/, '')
                .trim();

            console.log('Cleaned provenance text:', provenance);

            // 1. Obtenir les annotations DBpedia
            const annotations = await spotlightAnnotateWithRetry(provenance);
            console.log('DBpedia annotations received:', !!annotations);

            if (annotations?.Resources) {
                // 2. Trouver les dates
                const dates = findDates(provenance);
                console.log('Dates found:', dates.length);

                // 3. Associer les entités avec les dates
                const chronology = associateEntitiesWithDates(provenance, annotations.Resources, dates);
                console.log('Chronological entries created:', chronology.length);

                if (chronology.length > 0) {
                    results.push({
                        title: row.Title,
                        originalText: provenance,
                        chronology: chronology.map(entry => ({
                            date: entry.date,
                            entities: entry.entities,
                            context: entry.context
                        }))
                    });
                }
            }

            processedCount++;
            if (processedCount % CONFIG.BATCH_SIZE === 0) {
                await sleep(CONFIG.BATCH_DELAY);
            }
        }

        // Afficher et sauvegarder les résultats
        console.log('\n=== Final Results ===');
        console.log(`Processed ${processedCount} entries`);
        console.log(`Found ${results.length} entries with chronology`);

        const outputFile = path.join(RESOURCE_DIR, 'provenance_chronology.json');
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`\nResults saved to ${outputFile}`);

    } catch (error) {
        console.error('Error during processing:', error);
    }
}

if (require.main === module) {
    analyzeProvenance();
}

module.exports = {
    analyzeProvenance,
    spotlightAnnotateWithRetry,
    findDates,
    associateEntitiesWithDates
};