// matchingArtist.js
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
    
    // Retirer la ligne qui supprime les préfixes
    name = name.replace(/\([^)]*\)/g, '')
             .replace(/\s+/g, ' ')
             .trim();
             
    return name;
}

function getCleanArtistName(artist) {
    return artist.split(/\s*(?:birth|death|place|title|object)/i)[0].trim().replace(/;$/, '');
}

function findMatches() {
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

    // Compter le nombre total d'artistes (sans les unknown)
    const totalArtists = restitutionData.filter(row => 
        row.Artist && !row.Artist.toLowerCase().includes('unknown')
    ).length;

    const uniqueMatches = new Set();
    const matches = [];

    restitutionData.forEach(restitutionRow => {
        if (!restitutionRow.Artist || restitutionRow.Artist.toLowerCase().includes('unknown')) return;
        
        const normalizedArtistName = normalizeArtistName(restitutionRow.Artist);
        if (!normalizedArtistName) return;

        const artistNameWords = new Set(normalizedArtistName.toLowerCase().split(/\s+/));
        
        topicProvData.forEach(topicRow => {
            if (!topicRow.main_subjectLabel) return;
            
            const normalizedSubject = normalizeArtistName(topicRow.main_subjectLabel);
            if (!normalizedSubject) return;
            
            const subjectWords = new Set(normalizedSubject.toLowerCase().split(/\s+/));
            
            const allWordsMatch = Array.from(artistNameWords).every(word => subjectWords.has(word)) &&
                                Array.from(subjectWords).every(word => artistNameWords.has(word));
            
            if (allWordsMatch) {
                const uniqueKey = `${normalizedArtistName}|${normalizedSubject}`;
                
                if (!uniqueMatches.has(uniqueKey)) {
                    uniqueMatches.add(uniqueKey);
                    matches.push({
                        originalArtist: getCleanArtistName(restitutionRow.Artist),
                        originalSubject: topicRow.main_subjectLabel
                    });
                }
            }
        });
    });

    console.log("Correspondances exactes entre Artist (Restitution.csv) et main_subjectLabel (TopicProv.csv):");
    console.log("==========================================================================");

    matches.forEach(match => {
        console.log(`\nArtist: "${match.originalArtist}"`);
        console.log(`main_subjectLabel: "${match.originalSubject}"`);
    });

    const percentage = (matches.length / totalArtists) * 100;
    console.log("\nNombre total de correspondances exactes:", matches.length);
    console.log(`Pourcentage d'artistes trouvés: ${percentage.toFixed(2)}% (sur ${totalArtists} artistes renseignés)`);
}

if (require.main === module) {
    findMatches();
}

module.exports = {
    findMatches
};