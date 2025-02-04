const { Transform } = require('./transform');
const { datasets } = require('./queries');
const fs = require('fs');
const path = require('path');

class ProvenanceTransform extends Transform {
    constructor(db, config) {
        super(db, config);
    }

    async fetchItems() {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources/recategorized_data.json'), 'utf8'));
            this.values = await this.clean(data.data);
            return null;
        } catch (error) {
            return { message: `Fetch failed: ${error}` };
        }
    }

    async clean(data) {
        console.log("Cleaning data in provenance transform");
        
        const validData = data.filter(d => {
            const date = new Date(d.date);
            return !isNaN(date.getTime());
        });

        const values = validData.map(d => {
            const date = new Date(d.date);
            const year = date.getFullYear();
            
            return {
                uri: {
                    type: "uri",
                    value: d.id
                },
                title: {
                    type: "literal", 
                    value: d.title
                },
                date: {
                    type: "typed-literal",
                    datatype: "http://www.w3.org/2001/XMLSchema#date",
                    value: d.date
                },
                ego: {
                    type: "literal",
                    value: `${d.subject?.name || ""} (${d.subject?.detailedCategory?.mainType || "OTHER"})`
                },
                alter: {
                    type: "literal", 
                    value: `${d.depicts?.name || ""} (${d.depicts?.detailedCategory?.mainType || "OTHER"})`
                }
            };
        });
     
        return values.filter(v => 
            v.ego.value && v.ego.value !== " (OTHER)" && 
            v.alter.value && v.alter.value !== " (OTHER)"
        );
    }

    async getNodeLabels() {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources/recategorized_data.json'), 'utf8'));
            const nodesSet = new Set();
            
            // Ajouter les sujets et les depicts au set pour dédupliquer
            data.data.forEach(item => {
                if (item.subject?.name) {
                    const value = `${item.subject.name} (${item.subject.detailedCategory?.mainType || "OTHER"})`;
                    nodesSet.add(value);
                }
                if (item.depicts?.name) {
                    const value = `${item.depicts.name} (${item.depicts.detailedCategory?.mainType || "OTHER"})`;
                    nodesSet.add(value);
                }
            });

            // Convertir en tableau d'objets avec la propriété value
            const nodes = Array.from(nodesSet).map(value => ({ value }));
            console.log(`Generated ${nodes.length} unique nodes`);
            
            return nodes;
        } catch (error) {
            console.error("Error in getNodeLabels:", error);
            return [];
        }
    }

    getNode(value) {
        // La valeur est exactement comme dans la liste déroulante
        return { value };
    }
}

module.exports = {
    ProvenanceTransform
};