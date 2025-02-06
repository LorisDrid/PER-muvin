const { Transform } = require('./transform');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ArtworkTransform extends Transform {
    constructor(db, config) {
        super(db, config);
        this.resourcePath = path.join(__dirname, '..', 'resources');
    }

    async fetchItems() {
        try {
            const dataPath = path.join(this.resourcePath, 'transformed_data.json');
            
            if (!fs.existsSync(dataPath)) {
                throw new Error('transformed_data.json does not exist');
            }

            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            this.values = await this.clean(data.items);
            return null;
            
        } catch (error) {
            return { message: `Error reading data: ${error.message}` };
        }
    }

    async clean(data) {
        let values = [];

        // Extract type properly from node name
        const currentNodeType = this.data.node.name.match(/\((.*?)\)$/)[1];

        // Filter items related to the current node
        const relevantItems = data.filter(item => 
            item.ego.value === this.data.node.name || 
            item.alter.value === this.data.node.name
        );

        for (let item of relevantItems) {
            // Clean up type names by removing any trailing parentheses
            const egoType = item.egoNature.value.replace(/\)$/, '');
            const alterType = item.alterNature.value.replace(/\)$/, '');

            values.push({
                uri: { value: item.uri.value },
                ego: { value: this.data.node.name },
                egoNature: { value: egoType },
                type: { value: item.type.value },
                title: { value: item.title.value },
                date: { value: item.date.value },
                alter: { value: item.ego.value === this.data.node.name ? item.alter.value : item.ego.value },
                alterNature: { value: alterType },
                link: { value: item.link ? item.link.value : null },
                nodeKey: this.hash(this.data.node.name),
                node: {
                    name: this.data.node.name,
                    type: currentNodeType,
                    key: this.hash(this.data.node.name),
                    contribution: [item.type.value]
                }
            });
        }

        return values;
    }

    hash(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    async getNodeLabels() {
        try {
            const dataPath = path.join(this.resourcePath, 'transformed_data.json');
            
            if (!fs.existsSync(dataPath)) {
                throw new Error('transformed_data.json does not exist');
            }

            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            return data.nodes;
        } catch (error) {
            console.error("Error in getNodeLabels:", error);
            return [];
        }
    }
}

module.exports = {
    ArtworkTransform
};