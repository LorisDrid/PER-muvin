const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const CONFIG = {
    BATCH_SIZE: 5,
    MODEL: "mistral",
    OLLAMA_URL: "http://localhost:11434/api/generate",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000
};

const SYSTEM_PROMPT = `Tu es un expert en analyse de textes historiques concernant la provenance d'œuvres d'art.

INSTRUCTIONS TRÈS IMPORTANTES :
1. Ta réponse doit être UN SEUL objet JSON valide
2. Toujours commencer par { et finir par }
3. TOUJOURS inclure le tableau "artworks"
4. JAMAIS de JSON séparés par des virgules
5. TOUJOURS utiliser la structure exacte suivante, sans exception

Structure OBLIGATOIRE :
{
  "artworks": [
    {
      "id": 1,
      "events": [
        {
          "eventType": "confiscation",
          "date": {
            "year": "1942",
            "precision": "exact",
            "alternativeDate": "unknown"
          },
          "actors": [
            {
              "name": "Nazi authorities",
              "role": "perpetrator",
              "type": "institution",
              "certainty": "high"
            }
          ],
          "location": {
            "place": "Berlin",
            "certainty": "high"
          },
          "details": "Artwork was confiscated from the museum",
          "confidence": "high",
          "sourceText": "1942: confiscated by Nazi authorities in Berlin"
        }
      ]
    }
  ]
}

VALEURS AUTORISÉES (ne pas en utiliser d'autres) :
- eventType: ["ownership", "sale", "confiscation", "transfer", "loss", "restitution", "agreement"]
- precision: ["exact", "circa", "before", "after", "between"]
- role: ["owner", "seller", "buyer", "victim", "perpetrator", "restitutor", "recipient", "agent"]
- type: ["person", "institution"]
- certainty: ["high", "medium", "low"]

Si une information est manquante, utiliser "unknown".
Ne pas inventer d'informations.`;

class OllamaAnalyzer {
    createBatchPrompt(artworks) {
        let prompt = `${SYSTEM_PROMPT}\n\nAnalyse ces textes de provenance et renvoie UN SEUL objet JSON :\n\n`;
        
        artworks.forEach((artwork, index) => {
            prompt += `=== ARTWORK ${index + 1} ===\n`;
            prompt += `Title: ${artwork.title}\n`;
            prompt += `Provenance text: ${artwork.restitutionInfo.provenance}\n\n`;
        });

        prompt += `\nIMPORTANT : Ta réponse doit être UN SEUL objet JSON valide contenant un tableau "artworks".\n`;
        prompt += `COMMENCE ta réponse par { et TERMINE par }.\n`;
        prompt += `N'ajoute AUCUN texte avant ou après le JSON.`;

        return prompt;
    }

    cleanLLMResponse(response) {
        try {
            // Retirer tout ce qui n'est pas entre le premier { et le dernier }
            const match = response.match(/\{[\s\S]*\}/);
            if (!match) {
                console.log('Raw response:', response);
                throw new Error('No JSON object found in response');
            }

            let jsonStr = match[0];

            // Si on a plusieurs objets JSON séparés par des virgules, les wrapper dans un tableau
            if (jsonStr.includes('}{')) {
                jsonStr = jsonStr.replace(/\}\s*\{/g, '},{');
                jsonStr = `{"artworks":[${jsonStr}]}`;
            }

            // Parser pour vérifier la validité
            const parsed = JSON.parse(jsonStr);

            // Vérifier la structure
            if (!parsed.artworks || !Array.isArray(parsed.artworks)) {
                console.log('Invalid structure:', parsed);
                throw new Error('Response does not contain artworks array');
            }

            // Valider et nettoyer chaque artwork
            const cleaned = {
                artworks: parsed.artworks.map((artwork, index) => ({
                    id: artwork.id || index + 1,
                    events: Array.isArray(artwork.events) ? artwork.events.map(this.cleanEvent.bind(this)) : []
                }))
            };

            return JSON.stringify(cleaned, null, 2);
        } catch (error) {
            console.error('Error during JSON cleaning:', error);
            console.error('Raw response:', response);
            throw error;
        }
    }

    cleanEvent(event) {
        if (!event) return null;

        return {
            eventType: this.validateEventType(event.eventType),
            date: {
                year: this.cleanYear(event.date?.year),
                precision: this.validatePrecision(event.date?.precision),
                alternativeDate: this.cleanYear(event.date?.alternativeDate)
            },
            actors: Array.isArray(event.actors) ? event.actors.map(this.cleanActor.bind(this)) : [],
            location: {
                place: event.location?.place || "unknown",
                certainty: this.validateCertainty(event.location?.certainty)
            },
            details: event.details || "unknown",
            confidence: this.validateCertainty(event.confidence),
            sourceText: event.sourceText || "unknown"
        };
    }

    cleanActor(actor) {
        if (!actor) return null;

        return {
            name: actor.name || "unknown",
            role: this.validateRole(actor.role),
            type: this.validateType(actor.type),
            certainty: this.validateCertainty(actor.certainty)
        };
    }

    validateEventType(type) {
        const validTypes = ["ownership", "sale", "confiscation", "transfer", "loss", "restitution", "agreement"];
        return validTypes.includes(type) ? type : "unknown";
    }

    validateRole(role) {
        const validRoles = ["owner", "seller", "buyer", "victim", "perpetrator", "restitutor", "recipient", "agent"];
        return validRoles.includes(role) ? role : "unknown";
    }

    validateType(type) {
        const validTypes = ["person", "institution"];
        return validTypes.includes(type) ? type : "unknown";
    }

    validatePrecision(precision) {
        const validPrecisions = ["exact", "circa", "before", "after", "between"];
        return validPrecisions.includes(precision) ? precision : "unknown";
    }

    validateCertainty(certainty) {
        const validCertainties = ["high", "medium", "low"];
        return validCertainties.includes(certainty) ? certainty : "unknown";
    }

    cleanYear(year) {
        if (!year) return "unknown";
        
        // Format YYYY-YYYY
        const rangeMatch = String(year).match(/^(\d{4})-(\d{4})$/);
        if (rangeMatch) return year;

        // Format YYYY
        const yearMatch = String(year).match(/^\d{4}$/);
        if (yearMatch) return year;

        return "unknown";
    }
    async analyzeBatch(artworks) {
        try {
            console.log(`\nAnalyzing batch of ${artworks.length} artworks...`);
            
            const prompt = this.createBatchPrompt(artworks);
            const response = await this.generateCompletion(prompt);
            
            // Nettoyer et parser la réponse
            const cleanedJson = this.cleanLLMResponse(response);
            const parsedResponse = JSON.parse(cleanedJson);
    
            return {
                timestamp: new Date().toISOString(),
                artworks: artworks.map(a => ({ 
                    title: a.title,
                    originalProvenance: a.restitutionInfo.provenance 
                })),
                analysis: parsedResponse
            };
    
        } catch (error) {
            console.error('Error in analyzeBatch:', error);
            
            if (artworks.length > 1) {
                console.log('Splitting batch and retrying...');
                const mid = Math.floor(artworks.length / 2);
                const results1 = await this.analyzeBatch(artworks.slice(0, mid));
                const results2 = await this.analyzeBatch(artworks.slice(mid));
    
                return {
                    timestamp: new Date().toISOString(),
                    artworks: [...results1.artworks, ...results2.artworks],
                    analysis: {
                        artworks: [
                            ...(results1.analysis?.artworks || []),
                            ...(results2.analysis?.artworks || [])
                        ]
                    }
                };
            }
            
            throw error;
        }
    }

    async generateCompletion(prompt, retryCount = 0) {
        try {
            const response = await fetch(CONFIG.OLLAMA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    prompt: prompt,
                    stream: false
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            
            if (!data.response) {
                console.error('Unexpected response format:', data);
                throw new Error('Invalid response format from Ollama');
            }
    
            return data.response;
    
        } catch (error) {
            if (retryCount < CONFIG.MAX_RETRIES) {
                console.log(`Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} after error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
                return this.generateCompletion(prompt, retryCount + 1);
            }
            throw error;
        }
    }
}

async function processArtworks() {
    try {
        const resourceDir = path.join(__dirname, '..', 'resources');
        const statePath = path.join(resourceDir, 'ollama_analysis_state.json');
        
        // Charger l'état précédent
        let state = { processedCount: 0, results: [] };
        if (fs.existsSync(statePath)) {
            state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            console.log(`Resuming from artwork ${state.processedCount}`);
        }

        // Charger et filtrer les données
        const inputData = JSON.parse(fs.readFileSync(path.join(resourceDir, 'preprocessed_data.json'), 'utf8'));
        const artworks = inputData.artworks
            .filter(a => a.restitutionInfo?.provenance?.trim())
            .slice(state.processedCount);

        console.log(`Found ${artworks.length} remaining artworks to process`);
        
        const analyzer = new OllamaAnalyzer();
        let batchIndex = 0;

        while (batchIndex < artworks.length) {
            const batch = artworks.slice(batchIndex, batchIndex + CONFIG.BATCH_SIZE);
            
            try {
                const results = await analyzer.analyzeBatch(batch);
                state.results.push(results);
                state.processedCount += batch.length;

                // Sauvegarder l'état après chaque batch
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
                
                console.log(`Processed ${state.processedCount}/${artworks.length + state.processedCount} artworks`);

            } catch (error) {
                console.error('Error processing batch:', error);
                // Sauvegarder l'état en cas d'erreur
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
                throw error;
            }

            batchIndex += CONFIG.BATCH_SIZE;
        }

        // Sauvegarder les résultats finaux
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(resourceDir, `ollama_analysis_${timestamp}.json`);
        
        fs.writeFileSync(outputPath, JSON.stringify({
            metadata: {
                completedAt: new Date().toISOString(),
                totalProcessed: state.processedCount,
                model: CONFIG.MODEL
            },
            results: state.results
        }, null, 2));

        console.log(`\nProcessing complete. Results saved to ${outputPath}`);

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

module.exports = { processArtworks, OllamaAnalyzer };

if (require.main === module) {
    processArtworks();
}