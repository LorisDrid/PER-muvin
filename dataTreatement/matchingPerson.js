const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');
const topicProvFile = path.join(RESOURCE_DIR, 'TopicProv.csv');
const restitutionFile = path.join(RESOURCE_DIR, 'Restitution.csv');

function normalizeArtistName(artist) {
    if (!artist) return null;
    
    let name = artist.split(/\s*(?:birth|death|place|title|object)/i)[0].trim();
    name = name.replace(/;$/, '').trim();
    
    if (name.includes(',')) {
        const [lastName, firstName] = name.split(',').map(part => part.trim());
        name = `${firstName} ${lastName}`;
    }
    
    name = name.replace(/\([^)]*\)/g, '')
             .replace(/\b(von|van|der|de|du)\b/gi, '')
             .replace(/\s+/g, ' ')
             .trim();
             
    return name;
}

function getCleanArtistName(artist) {
    return artist.split(/\s*(?:birth|death|place|title|object)/i)[0].trim().replace(/;$/, '');
}

function findPersonMatches() {
    const topicProvContent = fs.readFileSync(topicProvFile, 'utf8');
    const restitutionContent = fs.readFileSync(restitutionFile, 'utf8');

    const topicProvData = Papa.parse(topicProvContent, {
        header: true,
        skipEmptyLines: true
    }).data;

    const restitutionData = Papa.parse(restitutionContent, {
        header: true,
        skipEmptyLines: true
    }).data;

    // Compter le nombre total de personnes (sans les unknown)
    const totalPersons = restitutionData.filter(row => 
        row.Person && !row.Person.toLowerCase().includes('unknown')
    ).length;

    const uniqueMatches = new Set();
    const matches = [];

    restitutionData.forEach(restitutionRow => {
        if (!restitutionRow.Person || restitutionRow.Person.toLowerCase().includes('unknown')) return;
        
        const normalizedPersonName = normalizeArtistName(restitutionRow.Person);
        if (!normalizedPersonName) return;

        const personNameWords = new Set(normalizedPersonName.toLowerCase().split(/\s+/));
        
        topicProvData.forEach(topicRow => {
            if (!topicRow.main_subjectLabel) return;
            
            const normalizedSubject = normalizeArtistName(topicRow.main_subjectLabel);
            if (!normalizedSubject) return;
            
            const subjectWords = new Set(normalizedSubject.toLowerCase().split(/\s+/));
            
            const allWordsMatch = Array.from(personNameWords).every(word => subjectWords.has(word)) &&
                                Array.from(subjectWords).every(word => personNameWords.has(word));
            
            if (allWordsMatch) {
                const uniqueKey = `${normalizedPersonName}|${normalizedSubject}`;
                
                if (!uniqueMatches.has(uniqueKey)) {
                    uniqueMatches.add(uniqueKey);
                    matches.push({
                        originalPerson: getCleanArtistName(restitutionRow.Person),
                        originalSubject: topicRow.main_subjectLabel
                    });
                }
            }
        });
    });

    console.log("Correspondances exactes entre Person (Restitution.csv) et main_subjectLabel (TopicProv.csv):");
    console.log("==========================================================================");

    matches.forEach(match => {
        console.log(`\nPerson: "${match.originalPerson}"`);
        console.log(`main_subjectLabel: "${match.originalSubject}"`);
    });

    const percentage = (matches.length / totalPersons) * 100;
    console.log("\nNombre total de correspondances exactes:", matches.length);
    console.log(`Pourcentage de personnes trouvées: ${percentage.toFixed(2)}% (sur ${totalPersons} personnes renseignées)`);
}

// Pour lancer la fonction quand le script est exécuté directement
if (require.main === module) {
    findPersonMatches();
}

module.exports = {
    findPersonMatches
};