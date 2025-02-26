const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { NlpManager } = require('node-nlp');

// Fonction utilitaire pour le délai exponentiel
function exponentialBackoff(attempt, baseDelay = 2000) {
    const maxDelay = 30000; // 30 secondes maximum
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
    const jitter = delay * 0.1 * Math.random(); // 10% de jitter
    return delay + jitter;
}

// Fonction pour faire une requête avec retry
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            if (response.status === 429) {
                const delay = exponentialBackoff(attempt);
                console.log(`Rate limit hit. Waiting ${delay/1000}s before retry ${attempt + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            
            const delay = exponentialBackoff(attempt);
            console.log(`Error: ${error.message}. Retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries reached');
}

async function searchWikidata(name) {
    try {
        const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*&limit=5`;
        
        const data = await fetchWithRetry(searchUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ModiglianiResearch/1.0'
            }
        });
        
        if (!data.search || data.search.length === 0) {
            return null;
        }

        const entities = await Promise.all(
            data.search.map(async result => {
                const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${result.id}&languages=en&format=json&origin=*`;
                
                const entityData = await fetchWithRetry(entityUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'ModiglianiResearch/1.0'
                    }
                });

                const entity = entityData.entities[result.id];
                const description = entity.descriptions?.en?.value || result.description || 'No description available';
                
                // Vérifier si lié à l'art
                const isArtRelated = description.toLowerCase().match(
                    /(artist|art|collector|dealer|gallery|museum|painter|sculptor|curator)/
                );
                
                if (isArtRelated) {
                    return {
                        name: result.label,
                        wikidata: `http://www.wikidata.org/entity/${result.id}`,
                        description: description,
                        score: result.score || 0
                    };
                }
                return null;
            })
        );

        return entities.filter(e => e !== null);

    } catch (error) {
        console.error(`Error searching Wikidata for ${name}:`, error.message);
        return null;
    }
}

async function validateNames() {
    // Initialiser NLP
    const nlp = new NlpManager({ languages: ['en'] });
    await nlp.train();

    const RESOURCE_DIR = path.join(process.cwd(), '../resources');
    const inputFile = path.join(RESOURCE_DIR, 'scumbag_article.json');

    // Lire les noms extraits
    const articleData = JSON.parse(fs.readFileSync(inputFile));
    const potentialNames = new Set(articleData.allPotentialNames);

    // Filtres préliminaires avec NLP
    const filteredNames = [];
    for (const name of potentialNames) {
        const result = await nlp.process('en', name);
        const isValidName = !(
            name.toUpperCase() === name || // Tout en majuscules
            name.includes('PAINTINGS') ||
            /^[A-Z\s]+$/.test(name) || // Que des majuscules et espaces
            name.length < 4 || // Trop court
            /\d/.test(name) || // Contient des chiffres
            /[^a-zA-Z\s\-\']/.test(name.replace(/^(Mr\.|Mrs\.|Dr\.|Prof\.)/, '')) // Caractères spéciaux sauf dans les titres
        ) && (result.entities.length > 0 || name.split(' ').length >= 2); // Vérifie si c'est une entité ou un nom composé

        if (isValidName) {
            filteredNames.push(name);
        }
    }

    const validatedNames = [];
    const corrections = [];

    for (const name of filteredNames) {
        try {
            console.log(`Processing: ${name}`);
            const results = await searchWikidata(name);
            
            if (results && results.length > 0) {
                // Vérifier si le nom trouvé est une correction du nom original
                if (results[0].name.toLowerCase() !== name.toLowerCase()) {
                    corrections.push({
                        original: name,
                        corrected: results[0].name,
                        confidence: results[0].score
                    });
                    console.log(`🔄 Corrected: ${name} → ${results[0].name}`);
                }

                validatedNames.push({
                    original: name,
                    corrected: results[0].name !== name ? results[0].name : null,
                    validations: results.map(result => ({
                        wikidata: result.wikidata,
                        description: result.description,
                        confidence: result.score
                    }))
                });
                console.log(`✓ Validated: ${results[0].name}`);
            } else {
                // Essayer avec une version simplifiée du nom
                const simplifiedName = name.replace(/[^a-zA-Z\s]/g, '');
                if (simplifiedName !== name) {
                    const retryResults = await searchWikidata(simplifiedName);
                    if (retryResults && retryResults.length > 0) {
                        validatedNames.push({
                            original: name,
                            corrected: retryResults[0].name,
                            validations: retryResults.map(result => ({
                                wikidata: result.wikidata,
                                description: result.description,
                                confidence: result.score
                            }))
                        });
                        console.log(`✓ Validated (after simplification): ${retryResults[0].name}`);
                        continue;
                    }
                }
                console.log(`✗ Not found: ${name}`);
            }

            // Délai de base entre les requêtes pour éviter les erreurs 429
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`Error processing ${name}:`, error.message);
            // Attendre plus longtemps en cas d'erreur
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Sauvegarder les résultats
    const validationResults = {
        totalNamesFound: potentialNames.size,
        namesAfterFiltering: filteredNames.length,
        corrections: corrections,
        validatedNames: validatedNames,
        validationDate: new Date().toISOString()
    };

    fs.writeFileSync(
        path.join(RESOURCE_DIR, 'validated_names.json'),
        JSON.stringify(validationResults, null, 2)
    );

    // Afficher le résumé
    console.log('\nValidation Summary:');
    console.log(`Total names found: ${potentialNames.size}`);
    console.log(`Names after filtering: ${filteredNames.length}`);
    console.log(`Names corrected: ${corrections.length}`);
    console.log(`Names validated: ${validatedNames.length}`);
}

// Lancer le processus
validateNames().catch(console.error);