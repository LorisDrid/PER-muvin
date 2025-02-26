const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Chemins vers les fichiers CSV
const artOwnedPath = path.join(__dirname, '../resources/ArtOwnedByH.csv');
const restitutionPath = path.join(__dirname, '../resources/Restitution.csv');

// Fonction pour normaliser les chaînes de caractères
const normalize = (str) => {
    if (!str) return '';
    return str.toLowerCase().trim();
};

// Fonction pour trouver les détails d'une œuvre dans un dataset
const findArtworkDetails = (normalizedTitle, data, titleField) => {
    return data.find(row => normalize(row[titleField]) === normalizedTitle);
};

try {
    // Lire les fichiers
    const artOwnedData = fs.readFileSync(artOwnedPath, 'utf8');
    const restitutionData = fs.readFileSync(restitutionPath, 'utf8');

    // Parser les CSV
    const artOwned = Papa.parse(artOwnedData, {
        header: true,
        skipEmptyLines: true
    });

    const restitution = Papa.parse(restitutionData, {
        header: true,
        skipEmptyLines: true
    });

    // Créer des ensembles de titres normalisés
    const artOwnedTitles = new Set(
        artOwned.data.map(row => normalize(row['Item owned']))
    );
    const restitutionTitles = new Set(
        restitution.data.map(row => normalize(row['Title']))
    );

    // Trouver les œuvres communes
    const commonWorks = [...artOwnedTitles].filter(title => 
        restitutionTitles.has(title)
    );

    // Afficher les résultats
    console.log(`Nombre d'œuvres communes trouvées : ${commonWorks.length}\n`);
    console.log('='.repeat(80));
    console.log('\nDétails des œuvres communes :\n');

    commonWorks.sort().forEach((normalizedTitle, index) => {
        const artOwnedDetails = findArtworkDetails(normalizedTitle, artOwned.data, 'Item owned');
        const restitutionDetails = findArtworkDetails(normalizedTitle, restitution.data, 'Title');

        console.log(`${index + 1}. Œuvre : "${normalizedTitle}"\n`);
        
        console.log('Dans ArtOwnedByH :');
        console.log('-'.repeat(40));
        console.log(`Titre exact : ${artOwnedDetails['Item owned']}`);
        console.log(`Propriétaire : ${artOwnedDetails['Owner name']}`);
        console.log(`Description du propriétaire : ${artOwnedDetails['owner Description']}`);
        console.log(`Statut du propriétaire : ${artOwnedDetails['Owner Status']}`);
        console.log(`Wikidata Item : ${artOwnedDetails['Wikidata Item owned']}`);
        
        console.log('\nDans Restitution :');
        console.log('-'.repeat(40));
        console.log(`Titre exact : ${restitutionDetails['Title']}`);
        console.log(`Artiste : ${restitutionDetails['Artist']}`);
        console.log(`Date : ${restitutionDetails['Datierung']}`);
        console.log(`Matériau : ${restitutionDetails['Material']}`);
        console.log(`Dimensions : ${restitutionDetails['Height']}`);
        console.log(`Date de restitution : ${restitutionDetails['DATE RESTITUTION or SETTLEMENT']}`);
        console.log(`Statut : ${restitutionDetails['Status']}`);
        
        console.log('\n' + '='.repeat(80) + '\n');
    });

} catch (error) {
    console.error('Erreur lors du traitement des fichiers :', error);
}