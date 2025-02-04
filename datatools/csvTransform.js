    const { Transform } = require('./transform');
    const Papa = require('papaparse');
    const fs = require('fs');
    const path = require('path');

    class CSVTransform extends Transform {
        constructor(app, config) {
            super(app, config);
            this.csvPath = 'DATAVIZ.csv';
        }

        async fetchItems() {
            try {
                const fileContent = fs.readFileSync(this.csvPath, 'utf8');
                const parsedData = Papa.parse(fileContent, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true
                });

                this.values = await this.clean(parsedData.data);
                
                if (!this.values.length) {
                    return { message: `No results found for ${this.data.node.name}` };
                }

                return null; // No error
                
            } catch (error) {
                return { message: `Error processing CSV: ${error.message}` };
            }
        }

        async clean(data) {
            const values = [];
            
            // Filter data based on the search node
            const filteredData = data.filter(d => {
                const searchFields = [d.Tag, d.Category, d.Subject_Tag, d.depicts_Tag];
                return searchFields.some(field => field === this.data.node.name);
            });

            for (const d of filteredData) {
                // Create alters from various tag fields
                const alters = [];
                if (d.Subject_Tag) alters.push({ name: d.Subject_Tag, nature: 'subject' });
                if (d.depicts_Tag) alters.push({ name: d.depicts_Tag, nature: 'depicts' });
                if (d.publisher_Tag) alters.push({ name: d.publisher_Tag, nature: 'publisher' });
                if (d.author_Tag) alters.push({ name: d.author_Tag, nature: 'author' });

                // Create a record for each alter
                for (const alter of alters) {
                    values.push({
                        uri: { value: d['Object URL'] },
                        ego: { value: this.data.node.name },
                        egoNature: { value: this.data.node.type },
                        type: { value: d.Tag.toLowerCase() },
                        title: { value: d.Object },
                        date: { value: d['Date Publication'] },
                        link: { value: d['Object URL'] },
                        alter: { value: alter.name },
                        alterNature: { value: alter.nature },
                        parentName: { value: d.published_in_Tag || '' },
                        parentId: { value: d['Object URL'] }
                    });
                }
            }

            return values;
        }

        async getNodeLabels() {
            try {
                const fileContent = fs.readFileSync(this.csvPath, 'utf8');
                const parsedData = Papa.parse(fileContent, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true
                });

                // Collect unique values from relevant columns
                const uniqueValues = new Set();
                parsedData.data.forEach(row => {
                    [row.Tag, row.Category, row.Subject_Tag, row.depicts_Tag].forEach(value => {
                        if (value) uniqueValues.add(value);
                    });
                });

                return Array.from(uniqueValues).map(value => ({ value }));
                
            } catch (error) {
                return { message: `Error getting node labels: ${error.message}` };
            }
        }
    }

    module.exports = {
        CSVTransform: CSVTransform
    };