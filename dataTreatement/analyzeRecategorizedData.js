const fs = require('fs');

function analyzeRecategorizedData() {
    const data = JSON.parse(fs.readFileSync('../resources/recategorized_data.json'));
    
    const stats = {
        total: data.data.length,
        mediaTypes: {},
        subjects: {},
        depicts: {},
        actors: {},
        publications: {}
    };
    
    data.data.forEach(item => {
        const countOccurrence = (obj, key) => {
            obj[key] = (obj[key] || 0) + 1;
        };
        
        // Comptage pour chaque catégorie
        countOccurrence(stats.mediaTypes, item.mediaType?.detailedCategory?.mainType || 'UNDEFINED');
        countOccurrence(stats.subjects, item.subject?.detailedCategory?.mainType || 'UNDEFINED');
        countOccurrence(stats.depicts, item.depicts?.detailedCategory?.mainType || 'UNDEFINED');
        item.actors?.forEach(actor => {
            countOccurrence(stats.actors, actor?.detailedCategory?.mainType || 'UNDEFINED');
        });
        countOccurrence(stats.publications, item.publication?.detailedCategory?.mainType || 'UNDEFINED');
    });
    
    // Tri des résultats par nombre d'occurrences
    const sortByCount = obj => Object.entries(obj)
        .sort(([,a], [,b]) => b - a)
        .reduce((acc, [k,v]) => ({...acc, [k]: v}), {});
    
    const results = {
        total: stats.total,
        mediaTypes: sortByCount(stats.mediaTypes),
        subjects: sortByCount(stats.subjects),
        depicts: sortByCount(stats.depicts),
        actors: sortByCount(stats.actors),
        publications: sortByCount(stats.publications)
    };
    
    console.log(JSON.stringify(results, null, 2));
}

analyzeRecategorizedData();