const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources');

function transformCSV() {
    try {
        const inputFile = path.join(RESOURCE_DIR, 'TopicProv.csv');
        const outputFile = path.join(RESOURCE_DIR, 'transformed_data.json');

        console.log('Reading from:', inputFile);

        if (!fs.existsSync(inputFile)) {
            throw new Error(`File ${inputFile} does not exist`);
        }

        const inputContent = fs.readFileSync(inputFile, { encoding: 'utf8' });
        console.log('File content length:', inputContent.length);

        const parsedData = Papa.parse(inputContent, {
            header: true,
            skipEmptyLines: true,
            delimiter: ';'
        });

        console.log('Parsed data rows:', parsedData.data.length);
        console.log('First row:', parsedData.data[0]);

        // Create nodes set
        const nodesMap = new Map();

        // Process each row to create nodes
        parsedData.data.forEach((row, index) => {
            if (index % 100 === 0) {
                console.log(`Processing row ${index}...`);
            }

            // Add nodes for each type of label if they exist
            if (row.main_subjectLabel && row.main_subjectLabel !== 'null') {
                const value = `${row.main_subjectLabel} (subject)`;
                nodesMap.set(value, { value: value });
            }

            if (row.publisherLabel && row.publisherLabel !== 'null') {
                const value = `${row.publisherLabel} (publisher)`;
                nodesMap.set(value, { value: value });
            }

            if (row.authorLabel && row.authorLabel !== 'null') {
                const value = `${row.authorLabel} (author)`;
                nodesMap.set(value, { value: value });
            }

            if (row.published_inLabel && row.published_inLabel !== 'null') {
                const value = `${row.published_inLabel} (publication)`;
                nodesMap.set(value, { value: value });
            }

            if (row.depictsLabel && row.depictsLabel !== 'null') {
                const value = `${row.depictsLabel} (depicts)`;
                nodesMap.set(value, { value: value });
            }
        });

        console.log('Created nodes:', nodesMap.size);

        // Create items array
        const items = [];
        
        parsedData.data.forEach((row, index) => {
            if (index % 100 === 0) {
                console.log(`Processing items for row ${index}...`);
            }

            const itemTags = [];
            
            if (row.main_subjectLabel && row.main_subjectLabel !== 'null') 
                itemTags.push(`${row.main_subjectLabel} (subject)`);
            if (row.publisherLabel && row.publisherLabel !== 'null') 
                itemTags.push(`${row.publisherLabel} (publisher)`);
            if (row.authorLabel && row.authorLabel !== 'null') 
                itemTags.push(`${row.authorLabel} (author)`);
            if (row.published_inLabel && row.published_inLabel !== 'null') 
                itemTags.push(`${row.published_inLabel} (publication)`);
            if (row.depictsLabel && row.depictsLabel !== 'null') 
                itemTags.push(`${row.depictsLabel} (depicts)`);

            // Create connections between tags
            itemTags.forEach(egoTag => {
                const alterTags = itemTags.filter(t => t !== egoTag);
                
                if (alterTags.length > 0) {
                    alterTags.forEach(alterTag => {
                        items.push({
                            uri: { value: row.item },
                            ego: { value: egoTag },
                            egoNature: { value: egoTag.split('(')[1].slice(0, -1) },
                            type: { value: row.typeLabel || "Undefined" },
                            title: { value: row.itemLabel },
                            date: { value: formatDate(row.publication_date) },
                            alter: { value: alterTag },
                            alterNature: { value: alterTag.split('(')[1].slice(0, -1) },
                            link: { value: row.full_work_available_at_URL || null },
                            parentName: { value: null },
                            parentId: { value: null }
                        });
                    });
                }
            });
        });

        console.log('Created items:', items.length);
        console.log('Sample item:', items[0]);

        const transformedData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                sourceFile: 'TopicProv.csv'
            },
            nodes: Array.from(nodesMap.values()),
            items: items
        };

        console.log('Writing to:', outputFile);
        fs.writeFileSync(outputFile, JSON.stringify(transformedData, null, 2));
        console.log('Transformation complete!');

        return transformedData;

    } catch (error) {
        console.error('Error during transformation:', error);
        throw error;
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    // Si c'est déjà une année seule
    if (/^\d{4}$/.test(dateString)) return dateString;
    
    // Essaye de parser la date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        // Retourne juste l'année pour la chronologie
        return date.getFullYear().toString();
    }
    
    // Si on ne peut pas parser la date, retourne vide
    return '';
}

if (require.main === module) {
    transformCSV();
}

module.exports = { transformCSV };