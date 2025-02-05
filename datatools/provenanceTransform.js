const { Transform } = require('./transform');
const { datasets } = require('./queries');
const fs = require('fs');
const path = require('path');

class ProvenanceTransform extends Transform {
    constructor(db, config) {
        super(db, config);
        this.resourcePath = path.resolve(__dirname, '../resources');
    }

    async fetchItems() {
        try {
            const dataPath = path.join(this.resourcePath, 'test_provenance_data.json');
            console.log("Reading from:", dataPath);
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            this.values = await this.clean(data.data);
            return null;
        } catch (error) {
            return { message: `Fetch failed: ${error.message}` };
        }
    }

    async clean(data) {
        console.log("Cleaning data, input length:", data.length);
        
        const values = data.map(d => {
            const date = new Date(d.date);
            if (isNaN(date.getTime())) return null;

            // Format date comme dans Wasabi: YYYY-MM-DD
            const formattedDate = date.toISOString().split('T')[0];
            
            // Convertir en minuscules comme dans Wasabi
            const mediaType = d.type ? d.type.toLowerCase() : "news";
            
            return {
                uri: d.uri,
                title: {
                    type: "literal",
                    value: d.title
                },
                date: {
                    type: "typed-literal",
                    datatype: "http://www.w3.org/2001/XMLSchema#date",
                    value: formattedDate
                },
                ego: d.ego,
                alter: d.alter,
                type: {
                    type: "literal",
                    value: mediaType
                }
            };
        }).filter(v => v !== null);

        const filtered = values.filter(v => 
            v.ego.value && 
            v.alter.value && 
            v.date.value
        );

        console.log(`Cleaned data: ${filtered.length} valid entries from ${values.length}`);
        return filtered;
    }

    async getNodeLabels() {
        try {
            const dataPath = path.join(this.resourcePath, 'test_provenance_data.json');
            console.log("Reading data for nodes from:", dataPath);
            
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            const nodesSet = new Set();
            
            // Collecter les noms uniques depuis le champ ego
            data.data.forEach(item => {
                if (item.ego?.value) {
                    nodesSet.add(item.ego.value);
                }
            });

            const nodes = Array.from(nodesSet)
                .sort()
                .map(value => ({ value }));

            console.log(`Generated ${nodes.length} artwork nodes:`, nodes);
            
            return nodes;
        } catch (error) {
            console.error("Error in getNodeLabels:", error);
            return [];
        }
    }
}

module.exports = {
    ProvenanceTransform
};