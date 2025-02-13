const { Transform } = require('./transform');
const fs = require('fs');
const path = require('path');

class RestitutionTransform extends Transform {
    constructor(db, config) {
        super(db, config);
        this.resourcePath = path.join(__dirname, '..', 'resources');
    }

    async fetchItems() {
        try {
            const jsonPath = path.join(this.resourcePath, 'restitution_analysis.json');
            
            if (!fs.existsSync(jsonPath)) {
                throw new Error('restitution_analysis.json does not exist. Please run dbpedia.js first.');
            }

            const jsonContent = fs.readFileSync(jsonPath, 'utf8');
            const analysisData = JSON.parse(jsonContent);
            
            this.values = await this.clean(analysisData);
            return null;

        } catch (error) {
            return { message: `Error reading data: ${error.message}` };
        }
    }

    findEventYear(text, event, years) {
        const eventIndex = text.toLowerCase().indexOf(event.toLowerCase());
        if (eventIndex === -1) return null;

        let closestYear = null;
        let minDistance = Infinity;
        
        for (const year of years) {
            const yearIndex = text.indexOf(year);
            if (yearIndex !== -1) {
                const distance = Math.abs(yearIndex - eventIndex);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestYear = year;
                }
            }
        }

        return minDistance < 100 ? parseInt(closestYear) : null;
    }

    async clean(data) {
        if (!this.data?.node?.name) {
            console.error('Node data is missing');
            return [];
        }

        // Récupérer le nom et type du nœud sélectionné
        const nodeName = this.data.node.name.split(' (')[0];
        const nodeType = this.data.node.name.split(' (')[1]?.replace(')', '');
        const nodeKey = this.hash(nodeName);

        console.log('Searching for node:', { nodeName, nodeType });

        const values = [];

        for (const item of data) {
            console.log('\nProcessing item:', item.title);
            if (!item.years || item.years.length === 0) {
                console.log('No years found, skipping');
                continue;
            }

            const involvedEntities = [
                ...item.persons,
                ...item.institutions,
                ...item.places
            ];

            // Vérifier si le nœud est impliqué
            const isNodeInvolved = involvedEntities.some(entity => {
                const match = entity.name === nodeName && entity.type === nodeType;
                if (match) {
                    console.log('Node found in entities of item:', item.title);
                }
                return match;
            });

            if (!isNodeInvolved) {
                console.log('Node not involved in this item');
                continue;
            }

            // Pour chaque transaction, créer un item
            for (const transaction of item.transactions) {
                const year = this.findEventYear(item.originalText, transaction, item.years);
                if (!year) {
                    console.log(`No year found for transaction: ${transaction}`);
                    continue;
                }

                console.log(`Creating item for ${transaction} in ${year}`);

                // Créer la base de l'item
                const baseItem = {
                    uri: { value: `${item.title}_${transaction}_${year}` },
                    ego: { value: this.data.node.name },
                    egoNature: { value: nodeType },
                    type: { value: transaction },
                    title: { value: `${transaction} of "${item.title}"` },
                    date: { value: year.toString() },
                    year: { value: year },
                    nodeKey: nodeKey,
                    node: {
                        name: this.data.node.name,
                        type: nodeType,
                        key: nodeKey,
                        contribution: [transaction]
                    }
                };

                // Ajouter un lien avec l'œuvre
                values.push({
                    ...baseItem,
                    alter: { value: `${item.title} (artwork)` },
                    alterNature: { value: 'artwork' }
                });

                // Ajouter des liens avec les autres entités impliquées
                involvedEntities.forEach(entity => {
                    if (entity.name !== nodeName || entity.type !== nodeType) {
                        values.push({
                            ...baseItem,
                            alter: { value: `${entity.name} (${entity.type})` },
                            alterNature: { value: entity.type }
                        });
                    }
                });
            }
        }

        console.log(`Generated ${values.length} items for node ${this.data.node.name}`);
        return values;
    }

    async getNodeLabels() {
        try {
            const jsonPath = path.join(this.resourcePath, 'restitution_analysis.json');
            const jsonContent = fs.readFileSync(jsonPath, 'utf8');
            const analysisData = JSON.parse(jsonContent);

            const nodes = new Set();
            
            // Ajouter les œuvres comme nœuds
            analysisData.forEach(item => {
                nodes.add(JSON.stringify({
                    value: `${item.title} (artwork)`
                }));

                // Ajouter toutes les autres entités
                const allEntities = [
                    ...item.persons,
                    ...item.institutions,
                    ...item.places
                ];

                allEntities.forEach(entity => {
                    nodes.add(JSON.stringify({
                        value: `${entity.name} (${entity.type})`
                    }));
                });
            });

            return Array.from(nodes).map(node => JSON.parse(node));

        } catch (error) {
            console.error("Error in getNodeLabels:", error);
            return [];
        }
    }

    hash(str) {
        return require('crypto').createHash('sha256').update(str).digest('hex');
    }
}

module.exports = {
    RestitutionTransform
};