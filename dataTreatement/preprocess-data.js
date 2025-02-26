const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

async function preprocessData() {
    try {
        const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
        
        // Lecture des fichiers CSV
        const restitutionPath = path.join(RESOURCE_DIR, 'Restitution.csv');
        const artOwnedPath = path.join(RESOURCE_DIR, 'ArtOwnedByH.csv');
        
        const restitutionContent = fs.readFileSync(restitutionPath, 'utf8');
        const artOwnedContent = fs.readFileSync(artOwnedPath, 'utf8');

        // Parsing des CSV
        const restitutionData = Papa.parse(restitutionContent, {
            header: true,
            skipEmptyLines: true
        });

        const artOwnedData = Papa.parse(artOwnedContent, {
            header: true,
            skipEmptyLines: true
        });

        // Création d'une Map pour regrouper toutes les informations par œuvre
        const artworksMap = new Map();

        // Traitement des données de restitution
        restitutionData.data
            .filter(row => row['DATE RESTITUTION or SETTLEMENT']?.trim())
            .forEach(row => {
                const artwork = {
                    title: row['Title'],
                    restitutionInfo: {
                        date: row['DATE RESTITUTION or SETTLEMENT'],
                        status: row['Status'],
                        involvedPerson: row['Person'],
                        provenance: cleanText(row['Provenance'])
                    },
                    artwork: {
                        artist: row['Artist'],
                        date: row['Datierung'],
                        material: row['Material'],
                        height: row['Height'],
                        image: row['Image']
                    },
                    metadata: {
                        id: row['Permalink To This Page']?.split('/').pop() || generateId(),
                        publishedSince: row['Published Since'],
                        contact: row['Contact'],
                        literature: row['Literature']
                    }
                };

                artworksMap.set(normalizeTitle(row['Title']), artwork);
            });

        // Ajout des informations de propriété depuis ArtOwnedByH
        artOwnedData.data.forEach(row => {
            const normalizedTitle = normalizeTitle(row['Item owned']);
            
            if (artworksMap.has(normalizedTitle)) {
                // Mettre à jour une œuvre existante
                const artwork = artworksMap.get(normalizedTitle);
                artwork.ownershipInfo = {
                    owner: {
                        name: row['Owner name'],
                        description: row['owner Description'],
                        status: row['Owner Status'],
                        wikidataId: row['Wikidata Owner'],
                        proveana: row['Proveana'],
                        gnd: row['GND']
                    },
                    wikidataItemId: row['Wikidata Item owned']
                };
            } else {
                // Créer une nouvelle entrée
                artworksMap.set(normalizedTitle, {
                    title: row['Item owned'],
                    ownershipInfo: {
                        owner: {
                            name: row['Owner name'],
                            description: row['owner Description'],
                            status: row['Owner Status'],
                            wikidataId: row['Wikidata Owner'],
                            proveana: row['Proveana'],
                            gnd: row['GND']
                        },
                        wikidataItemId: row['Wikidata Item owned']
                    }
                });
            }
        });

        // Conversion de la Map en tableau et filtrage des entrées vides
        const processedData = Array.from(artworksMap.values())
            .map(entry => ({
                ...entry,
                hasRestitutionInfo: !!entry.restitutionInfo,
                hasOwnershipInfo: !!entry.ownershipInfo
            }));

        // Statistiques sur les données
        const stats = {
            totalEntries: processedData.length,
            withRestitution: processedData.filter(e => e.hasRestitutionInfo).length,
            withOwnership: processedData.filter(e => e.hasOwnershipInfo).length,
            withBoth: processedData.filter(e => e.hasRestitutionInfo && e.hasOwnershipInfo).length
        };

        // Création de l'objet final
        const outputData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                stats: stats
            },
            artworks: processedData
        };

        // Sauvegarde des résultats
        const outputPath = path.join(RESOURCE_DIR, 'preprocessed_data.json');
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        
        // Affichage des statistiques
        console.log('\nTraitement terminé. Statistiques :');
        console.log('--------------------------------');
        console.log(`Total des œuvres : ${stats.totalEntries}`);
        console.log(`Avec information de restitution : ${stats.withRestitution}`);
        console.log(`Avec information de propriété : ${stats.withOwnership}`);
        console.log(`Avec les deux types d'information : ${stats.withBoth}`);
        console.log(`\nRésultats sauvegardés dans : ${outputPath}`);

    } catch (error) {
        console.error('Erreur durant le prétraitement :', error);
    }
}

// Fonctions utilitaires
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/;Read more;Read less/g, '')
        .replace(/;Read more/g, '')
        .replace(/;Read less/g, '')
        .trim();
}

function normalizeTitle(title) {
    if (!title) return '';
    return title.toLowerCase().trim();
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Exécution du script
preprocessData();

module.exports = {
    preprocessData
};