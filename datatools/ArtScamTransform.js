const { Transform } = require('./transform');
const fs = require('fs');
const path = require('path');

class ArtScamsTransform extends Transform {
    constructor(db, config) {
        super(db, config);
        this.loadData();
    }

    loadData() {
        try {
            const filePath = path.join(__dirname, '..', 'resources', 'art_scams.json');
            if (!fs.existsSync(filePath)) {
                console.error('art_scams.json does not exist at path:', filePath);
                this.rawData = null;
                return;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            this.rawData = JSON.parse(fileContent);
        } catch (error) {
            console.error('Error loading data:', error);
            this.rawData = null;
        }
    }

    async fetchItems() {
        try {
            if (!this.rawData) {
                return { message: "No data available. Please ensure art_scams.json is present in the resources directory." };
            }

            if (this.data.node.name === "Timeline (timeline)") {
                this.values = await this.processAllItems();
            } else {
                this.values = await this.processNodeItems();
            }

            if (!this.values.length) {
                return { message: `No items found for node: ${this.data.node.name}` };
            }

            return null;

        } catch (error) {
            return { message: `Error processing data: ${error.message}` };
        }
    }

    async processAllItems() {
        const values = [];
        
        this.rawData.items.forEach(item => {
            const value = {
                uri: { value: this.hash(item.title) },
                title: { value: item.title },
                date: { value: item.date || "1990-01-01" },
                type: { value: item.type },
                ego: { 
                    value: "Timeline (timeline)",
                    nodeLink: null 
                },
                egoNature: { value: "timeline" }
            };

            item.entities.forEach(entity => {
                const nodeInfo = this.rawData.nodes.find(n => n.value === entity.value);
                values.push({
                    ...value,
                    alter: { 
                        value: entity.value,
                        nodeLink: nodeInfo?.link || null 
                    },
                    alterNature: { value: entity.value.split(" (")[1].replace(")", "") }
                });
            });
        });

        return values;
    }

    async processNodeItems() {
        const values = [];
        const nodeName = this.data.node.name;
        const nodeInfo = this.rawData.nodes.find(n => n.value === nodeName);
        
        this.rawData.items
            .filter(item => item.entities.some(entity => entity.value === nodeName))
            .forEach(item => {
                const value = {
                    uri: { value: this.hash(item.title) },
                    title: { value: item.title },
                    date: { value: item.date || "1990-01-01" },
                    type: { value: item.type },
                    ego: { 
                        value: nodeName,
                        nodeLink: nodeInfo?.link || null 
                    },
                    egoNature: { value: nodeName.split(" (")[1].replace(")", "") }
                };

                item.entities
                    .filter(entity => entity.value !== nodeName)
                    .forEach(alterEntity => {
                        const alterInfo = this.rawData.nodes.find(n => n.value === alterEntity.value);
                        values.push({
                            ...value,
                            alter: { 
                                value: alterEntity.value,
                                nodeLink: alterInfo?.link || null 
                            },
                            alterNature: { value: alterEntity.value.split(" (")[1].replace(")", "") }
                        });
                    });
            });

        return values;
    }

    async getData(args) {
        // Extraire le type du format "Arthur Pfannstiel (expert)"
        const typeMatch = args.value.match(/\(([^)]+)\)/);
        const type = typeMatch ? typeMatch[1] : args.type;
        
        const nodeInfo = this.rawData?.nodes.find(n => n.value === args.value);
        
        // Construire le nœud principal avec toutes les propriétés nécessaires
        this.data.node = { 
            key: this.hash(args.value, type),  
            name: args.value, 
            value: args.value,
            type: type,
            nodeLink: nodeInfo?.link || null
        };
    
        let filepath = path.join(__dirname, `${this.datapath}/${this.getFileName()}`);
    
        if (fs.existsSync(filepath)) {
            let data = fs.readFileSync(filepath);
            data = JSON.parse(data);
            // S'assurer que le nœud mis en cache a le bon type
            if (data.node) {
                data.node = {
                    ...data.node,
                    type: type,
                    value: data.node.name,
                    nodeLink: nodeInfo?.link || null
                };
            }
            return data;
        }
                    
        let response = await this.fetchItems();
        
        if (response) 
            return response;
    
        await this.transform();
        
        // S'assurer que le type est préservé après la transformation
        if (this.data.node) {
            this.data.node.type = type;
        }
        
        await this.write();
    
        return this.data;
    }

    async transform() {
        let items = {};
       
        const groupedValues = this.values.reduce((groups, item) => {
            const key = item.uri.value;
            if (!groups[key]) {
                groups[key] = { key: key, values: [] };
            }
            groups[key].values.push(item);
            return groups;
        }, {});
    
        const nestedValues = Object.values(groupedValues);
    
        for (let item of nestedValues) {
            let ref = item.values[0];
            let year = ref.date.value.split('-')[0];
    
            if (year === "0000") continue;
    
            // Créer ego avec toutes les propriétés nécessaires
            const egoInfo = this.rawData.nodes.find(n => n.value === ref.ego.value);
            let ego = {
                key: this.hash(ref.ego.value, ref.egoNature.value),
                name: ref.ego.value,
                value: ref.ego.value,
                type: ref.egoNature.value,
                nodeLink: egoInfo?.link || null,
                contribution: [ref.type.value]
            };
    
            // Trouver l'item original dans rawData pour accéder aux entités et leurs rôles
            const originalItem = this.rawData.items.find(i => i.title === ref.title.value);
            
            // Créer alters avec toutes les propriétés nécessaires, y compris le rôle
            let alters = item.values.map(e => {
                const alterInfo = this.rawData.nodes.find(n => n.value === e.alter.value);
                
                // Trouver le rôle de cette entité dans l'item original
                let role = null;
                if (originalItem && originalItem.entities) {
                    const entity = originalItem.entities.find(entity => entity.value === e.alter.value);
                    if (entity) {
                        role = entity.role;
                    }
                }
                
                return {
                    key: this.hash(e.alter.value, e.alterNature.value),
                    name: e.alter.value,
                    value: e.alter.value,
                    type: e.alterNature.value,
                    nodeLink: alterInfo?.link || null,
                    role: role  // Ajouter le rôle
                };
            });
    
            // Trouver le rôle de l'ego aussi
            let egoRole = null;
            if (originalItem && originalItem.entities) {
                const egoEntity = originalItem.entities.find(entity => entity.value === ref.ego.value);
                if (egoEntity) {
                    egoRole = egoEntity.role;
                    ego.role = egoRole;  // Ajouter le rôle à l'ego
                }
            }
    
            // Ajouter ego aux alters s'il n'y est pas déjà
            if (!alters.find(a => a.key === ego.key)) {
                alters.push(ego);
            }
    
            // Enlever les doublons
            alters = alters.filter((e,i) => 
                alters.findIndex(x => x.key === e.key) === i
            );
    
            // Préserver les informations d'entités originales
            const entities = originalItem ? originalItem.entities : [];
    
            const itemKey = this.hash(item.key);
            items[itemKey] = {
                id: item.key,
                node: {
                    ...ego,  // Copier toutes les propriétés de ego
                    key: ego.key,
                    name: ego.name,
                    value: ego.value,
                    type: ego.type,
                    nodeLink: ego.nodeLink,
                    contribution: ego.contribution,
                    role: ego.role  // Inclure le rôle
                },
                title: ref.title.value,
                date: ref.date.value,
                year: parseInt(year),
                type: [ref.type.value],
                // Add the link from the original item
                link: originalItem ? originalItem.link : null,
                description: originalItem ? originalItem.description : null,
                contributors: alters.map(a => ({
                    ...a,  // Copier toutes les propriétés de l'alter
                    key: a.key,
                    name: a.name,
                    value: a.value,
                    type: a.type,
                    nodeLink: a.nodeLink,
                    role: a.role  // Inclure le rôle
                })),
                contnames: alters.map(d => d.name),
                entities: entities  // Ajouter les entités originales pour conserver les rôles
            };
        }
    
        this.data.items = Object.values(items);
    
        // Mettre à jour le node principal avec toutes les propriétés
        const mainNodeInfo = this.rawData.nodes.find(n => n.value === this.data.node.name);
        if (mainNodeInfo) {
            this.data.node = {
                key: this.data.node.key,
                name: this.data.node.name,
                value: this.data.node.name,
                type: this.data.node.type,
                nodeLink: mainNodeInfo.link || null
            };
        }
    
        return;
    }

    async getNodeLabels() {
        try {
            if (!this.rawData) {
                this.loadData();
            }
            if (!this.rawData) {
                return [];
            }
            
            const nodes = this.rawData.nodes.map(node => ({
                value: node.value,
                nodeLink: node.link || null
            }));
            
            nodes.push({
                value: "Timeline (timeline)",
                nodeLink: null
            });

            return nodes;

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
    ArtScamsTransform
};