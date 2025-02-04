const fs = require('fs');
const path = require('path');

const RESOURCE_DIR = '../resources';

// Nouvelle structure de catégorisation
const NEW_CATEGORIES = {
    MEDIA_TYPE: {
        NEWS: ['news article', 'article', 'press release'],
        INVESTIGATION: ['investigative journalism'],
        LEGAL_DOCUMENT: ['claim for restitution of an artwork', 'lawsuit', 'report'],
        LITERARY: ['literary work', 'non-fiction'],
        EXHIBITION: ['art exhibition']
    },
    SUBJECT_TYPE: {
        PEOPLE: [], // Sera rempli dynamiquement
        ARTWORKS: [], // Sera rempli dynamiquement
        INSTITUTIONS: ['museum', 'gallery', 'university', 'institute', 'foundation'],
        LEGAL_CONCEPTS: ['doctrine', 'restitution', 'claim', 'lawsuit'],
        REPORTS: ['report']
    },
    ORGANIZATION_TYPE: {
        MUSEUMS: ['museum'],
        PRESS: ['times', 'news', 'gazette'],
        PUBLISHER: ['press', 'publisher', 'knopf'],
        FOUNDATIONS: ['foundation']
    },
    MEDIA_SOURCE: {
        ART_NEWS: ['artnews', 'artnet', 'artsy'],
        ACADEMIC: ['journal', 'university press'],
        NEWSPAPERS: ['times', 'welt', 'gazette'],
        TRADE_PRESS: ['trade gazette']
    }
};

function getDetailedCategory(type, value) {
    if (!value) return { mainType: 'UNDEFINED', subType: 'UNDEFINED' };
    
    value = value.toLowerCase();
    
    // Parcourir les catégories principales
    for (const [mainType, subCategories] of Object.entries(NEW_CATEGORIES)) {
        for (const [subType, keywords] of Object.entries(subCategories)) {
            if (keywords.some(keyword => value.includes(keyword.toLowerCase()))) {
                return { mainType, subType };
            }
        }
    }

    // Gestion spéciale pour les personnes et œuvres d'art
    if (type === 'subject' || type === 'depicts') {
        // Si contient des mots comme "the", "and", c'est probablement une œuvre d'art
        if (value.includes(' the ') || value.includes(' and ')) {
            return { mainType: 'SUBJECT_TYPE', subType: 'ARTWORKS' };
        }
        // Si contient plusieurs mots avec des majuscules, c'est probablement une personne
        if (value.split(' ').filter(word => /^[A-Z]/.test(word)).length > 1) {
            return { mainType: 'SUBJECT_TYPE', subType: 'PEOPLE' };
        }
    }

    return { mainType: 'OTHER', subType: 'UNDEFINED' };
}

function recategorizeData() {
    try {
        const resourcePath = path.join(__dirname, RESOURCE_DIR);
        const inputPath = path.join(resourcePath, 'transformed_data.json');
        const outputPath = path.join(resourcePath, 'recategorized_data.json');

        // Lire le JSON existant
        const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

        // Recatégoriser les données
        const recategorizedData = jsonData.data.map(item => ({
            ...item,
            mediaType: {
                ...item.mediaType,
                detailedCategory: getDetailedCategory('media', item.mediaType.original)
            },
            subject: {
                ...item.subject,
                detailedCategory: getDetailedCategory('subject', item.subject.name)
            },
            depicts: {
                ...item.depicts,
                detailedCategory: getDetailedCategory('depicts', item.depicts.name)
            },
            actors: item.actors.map(actor => ({
                ...actor,
                detailedCategory: getDetailedCategory('actor', actor.name)
            })),
            publication: {
                ...item.publication,
                detailedCategory: getDetailedCategory('publication', item.publication.name)
            }
        }));

        // Générer des statistiques sur les nouvelles catégories
        const stats = {
            totalEntries: recategorizedData.length,
            byMainType: {},
            bySubType: {}
        };

        recategorizedData.forEach(item => {
            const { mainType, subType } = item.mediaType.detailedCategory;
            
            // Compter par type principal
            stats.byMainType[mainType] = (stats.byMainType[mainType] || 0) + 1;
            
            // Compter par sous-type
            const subTypeKey = `${mainType}-${subType}`;
            stats.bySubType[subTypeKey] = (stats.bySubType[subTypeKey] || 0) + 1;
        });

        // Sauvegarder les données recatégorisées
        const output = {
            metadata: {
                generatedAt: new Date().toISOString(),
                stats: stats
            },
            data: recategorizedData
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`Recatégorisation terminée. Fichier sauvegardé : ${outputPath}`);
        console.log('\nStatistiques :', JSON.stringify(stats, null, 2));

    } catch (error) {
        console.error('Erreur lors de la recatégorisation :', error);
    }
}

// Exécuter la recatégorisation
recategorizeData();