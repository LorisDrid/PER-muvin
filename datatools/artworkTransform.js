const { Transform } = require('./transform');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

class ArtworkTransform extends Transform {
    constructor(db, config) {
        super(db, config);
        this.resourcePath = path.join(__dirname, '..', 'resources');
    }

    async fetchItems() {
        try {
            const csvPath = path.join(this.resourcePath, 'TopicProv.csv');
            
            if (!fs.existsSync(csvPath)) {
                throw new Error('TopicProv.csv does not exist');
            }

            const csvContent = fs.readFileSync(csvPath, 'utf8');
            
            const parsedData = Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                delimiter: ';'
            });

            this.values = await this.clean(parsedData.data);
            return null;

        } catch (error) {
            return { message: `Error reading data: ${error.message}` };
        }
    }

    formatEntityName(name, type) {
        const cleanName = name.split(' (')[0];
        return `${cleanName} (${type})`;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    async clean(data) {
        const values = [];
        const processedItems = new Set();

        const nodeName = this.data.node.name.split(' (')[0];
        const nodeType = this.data.node.name.split(' (')[1]?.replace(')', '');

        const itemGroups = new Map();
        data.forEach(row => {
            if (row.itemLabel) {
                if (!itemGroups.has(row.itemLabel)) {
                    itemGroups.set(row.itemLabel, []);
                }
                itemGroups.get(row.itemLabel).push(row);
            }
        });

        for (let [itemLabel, rows] of itemGroups) {
            const hasNode = rows.some(row => {
                switch(nodeType) {
                    case 'subject': return row.main_subjectLabel === nodeName;
                    case 'publisher': return row.publisherLabel === nodeName;
                    case 'author': return row.authorLabel === nodeName;
                    case 'publication': return row.published_inLabel === nodeName;
                    case 'depicts': return row.depictsLabel === nodeName;
                    default: return false;
                }
            });

            if (!hasNode || processedItems.has(itemLabel)) continue;

            const allActors = new Map();
            rows.forEach(row => {
                if (row.main_subjectLabel)
                    allActors.set(this.formatEntityName(row.main_subjectLabel, 'subject'), 'subject');
                if (row.publisherLabel)
                    allActors.set(this.formatEntityName(row.publisherLabel, 'publisher'), 'publisher');
                if (row.authorLabel)
                    allActors.set(this.formatEntityName(row.authorLabel, 'author'), 'author');
                if (row.published_inLabel)
                    allActors.set(this.formatEntityName(row.published_inLabel, 'publication'), 'publication');
                if (row.depictsLabel)
                    allActors.set(this.formatEntityName(row.depictsLabel, 'depicts'), 'depicts');
            });

            const nodeFullName = this.formatEntityName(nodeName, nodeType);
            const alters = Array.from(allActors.entries())
                .filter(([name]) => name !== nodeFullName)
                .map(([name, type]) => ({ name, type }));

            if (alters.length > 0) {
                const referenceRow = rows[0];
                const itemType = this.capitalizeFirstLetter((referenceRow.typeLabel || 'undefined').toLowerCase());
                const nodeKey = this.hash(nodeFullName);

                alters.forEach(alter => {
                    const date = this.formatDate(referenceRow.publication_date);
                    const year = date ? parseInt(date.split('-')[0]) : null;
                    
                    values.push({
                        uri: { value: referenceRow.item },
                        ego: { value: nodeFullName },
                        egoNature: { value: nodeType },
                        type: { value: itemType },
                        title: { value: itemLabel },
                        date: { value: date },
                        year: year,  // Ajout du champ year directement dans l'objet
                        alter: { value: alter.name },
                        alterNature: { value: alter.type },
                        nodeKey: nodeKey,
                        node: {
                            name: nodeFullName,
                            type: nodeType,
                            key: nodeKey,
                            contribution: [itemType]
                        }
                    });
                });

                processedItems.add(itemLabel);
            }
        }

        console.log(`Generated ${values.length} values for node ${this.data.node.name}`);
        return values;
    }

    async getNodeLabels() {
        try {
            const csvPath = path.join(this.resourcePath, 'TopicProv.csv');
            
            if (!fs.existsSync(csvPath)) {
                throw new Error('TopicProv.csv does not exist');
            }

            const csvContent = fs.readFileSync(csvPath, 'utf8');
            
            const parsedData = Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                delimiter: ';'
            });

            const nodes = new Set();
            
            parsedData.data.forEach(row => {
                const fields = {
                    main_subjectLabel: 'subject',
                    publisherLabel: 'publisher',
                    authorLabel: 'author',
                    published_inLabel: 'publication',
                    depictsLabel: 'depicts'
                };

                Object.entries(fields).forEach(([field, type]) => {
                    if (row[field] && row[field] !== 'null') {
                        nodes.add(this.formatEntityName(row[field], type));
                    }
                });
            });

            return Array.from(nodes)
                .sort()
                .map(name => ({ value: name }));

        } catch (error) {
            console.error("Error in getNodeLabels:", error);
            return [];
        }
    }

    formatDate(dateString) {
        if (!dateString) return '';
        
        dateString = dateString.trim();
        
        if (/^\d{4}$/.test(dateString)) {
            return dateString;
        }
        
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            console.error("Error parsing date:", dateString);
        }
        
        return '';
    }

    hash(str) {
        return require('crypto').createHash('sha256').update(str).digest('hex');
    }
}

module.exports = {
    ArtworkTransform
};