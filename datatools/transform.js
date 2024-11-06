const fs = require('fs');
const path = require('path');

// const { datasets } = require('./queries')
const sparql = require('./sparql_helper')

const crypto = require('crypto')

const D3Node = require('d3-node')
const d3 = new D3Node().d3  

class Transform{
    constructor(db, config) {
       
        this.db = db
        this.values

        this.query = null

        if (config) {
            this.query = config.query
            this.endpoint = config.endpoint,
            this.queryhash = config.queryhash
        } 
        
        // if (datasets[this.db]) {
        //     this.nodeQuery = datasets[this.db].nodeFeatures
        // } 

        

        this.data = {
            items: null,
            links: null,
            node: null // incremental version
        }

        this.expectedKeys = ['uri', 'title', 'date', 'ego', 'alter']


    }

    async fetchItems() {

        function endsWithLimitPattern(str) {
            const regex = /\blimit \d+\b/i
            return regex.test(str);
        }
        
        // Dynamically find the special variable that needs to be replaced
        let variable = this.query.split(/[^A-Za-z0-9$]+/).find(v => v.startsWith('$'))

        // /\$value/g 
        // Dynamically build the regex
        let regex = new RegExp("\\" + variable, "g")
        
        let query = this.query.replace(regex, this.data.node.name)

        let withOffset = !endsWithLimitPattern(query)
        if (withOffset) // if the query does not have a limit by default, we loop to retrieve all matching data in the graph
            query += 'limit 10000 offset $offset'

        let result = await sparql.executeQuery(query, this.endpoint, withOffset)
        if (result.message) return result
        
        this.values = result

        if (!this.values.length) 
            return { message: `Value: ${this.data.node.name}\n The query did not return any results.`}

        
        let keys = Object.keys(this.values[0]) // variables in the select
        let containAllKeys = this.expectedKeys.every(value => keys.includes(value))
        if (!containAllKeys) { // if a required variable is missing, return
            let missingKeys = this.expectedKeys.filter(value => !keys.includes(value))
            return { message: `Value: ${this.data.node.name}\nThe query is missing the following required variables = ${missingKeys.join(', ')}` }
        }

        return
    }

    async fetchNodeFeatures() { // to be included directly on the main query
        if (!this.nodeQuery) return;

        let query = this.nodeQuery.replace(/\$node/g, this.data.node.name)

        let result = await sparql.sendRequest(query.replace('$offset', 0), this.endpoint)
        let bindings;
        try{
            result = JSON.parse(result)
            bindings = result.results.bindings
        } catch(e) {
            console.log(e)
        }

        return bindings
    }

    async transformNode() {

    }



    async clean() {
        
        let nestedValues = d3.nest()
            .key(d => d.uri.value)
            .entries(this.values)

        this.values = nestedValues.map(d => {

            let ref = d.values[0]

            let alters = d.values.map(e => e.alter ? e.alter.value : null)
            alters = alters.filter( (e,i) => e && alters.indexOf(e) === i) // keep only unique and valide values
            
            if (!alters.includes(ref.ego.value)) 
                alters.push(ref.ego.value) // add the ego information (to support filter in the query)

            let type = ref.type ? ref.type.value.toLowerCase() : 'unknown'

            return {
                id: ref.uri.value,
                title: ref.title.value,
                date: ref.date.value,
                type: type,
                link: ref.link ? ref.link.value : ref.uri.value,

                nodeName: ref.ego.value,
                nodeContribution: [ type ],

                contributors: alters.map(e => ({ name: e, type: type })),
            }
        })
   
    }

    async transform() {
        let items = {}
        //let links = {}

        let nestedValues = d3.nest()
            .key(d => d.uri.value)
            .entries(this.values)
    
        for (let item of nestedValues) {
          
            let ref = item.values[0] // takes the first one as reference for the unique information, such as name, year, etc.
            let year = ref.date.value.split('-')[0] // keeps only the year

            let ego = { name: ref.ego.value, type: ref.egoNature ? ref.egoNature.value : null }
            ego.key = this.hash(ego.name, ego.type)

            let alters = item.values.map(e => ({ name: e.alter ? e.alter.value : null, type: e.alterNature ? e.alterNature.value : null }) ) // retrieve all alters for a particular item
            alters.push(ego) // add the ego information (to support filter in the query)
            alters = alters.filter( (e,i) => e && alters.findIndex(x => x.name === e.name && x.type === e.type) === i) // keep only unique and valid values
            alters = alters.map(e => ({...e, key: this.hash(e.name, e.type) })) // add a key to each alter

            let types = item.values.map(e => e.type ? e.type.value : null) // identify all contribution types of ego in this item
            types = types.filter( (d,i) => d && types.indexOf(d) === i)

            ego.contribution = [...types]

            const key = this.hash(item.key) 
                
            items[key]  = {
                id: item.key,
                node: ego,
                title: ref.title.value,
                date: ref.date.value,
                year: year,
                type: types,
                contributors: alters,
                contnames: alters.map(d => d.name),
                // parent: parent, //TODO: add through the query select
                link: ref.link ? ref.link.value : null
                //nodeLink: item.nodeLink  
            }
    
            // TODO: remove the link creation ; it will be treated on the client side
            // for (let source of item.contributors) {
            //     if (item.key === source.key) continue

                
    
            //     let target = item.parentNodeName ? { name: item.parentNodeName, 
            //                                         type: item.parentNodeType, 
            //                                         key: item.parentNodeType ? this.hash(item.parentNodeName, item.parentNodeType) : this.hash(item.parentNodeName) } : 
            //                                                 { name: item.nodeName, type: item.nodeContribution, key: this.data.node.key }
    

            //     let sourceKey = this.hash(item.id, year, source.name, source.type, target.name, target.type)
            //     let targetKey = this.hash(item.id, year, target.name, target.type, source.name, source.type)

            //     if (!links[sourceKey] && !links[targetKey])  
            //         links[sourceKey] = {
            //             source: source,
            //             target: target,
            //             year: year,
            //             type: source.type,
            //             item: value.id
            //         }
            // }       
    
        }

        this.data.items = Object.values(items)
        // this.data.links = Object.values(links)

    }

    async createFolder() {

        let appdata = `../data/${this.db}`

        if (!fs.existsSync(path.join(__dirname, appdata))) {
            try {
                fs.mkdirSync(path.join(__dirname, appdata), { recursive: true });
            } catch(e) {
                console.log(`Error while creating folder "${appdata}": ${e.message}.`)
            }
        } 

        this.datapath = `${appdata}/${this.queryhash}`

        if (!fs.existsSync(path.join(__dirname, this.datapath))) {
            try {
                fs.mkdirSync(path.join(__dirname, this.datapath), { recursive: true });
            } catch(e) {
                console.log(`Error while creating folder "${this.datapath}": ${e.message}.`)
            }
        } 
    }

    async write() {

        let filepath = path.join(__dirname, `${this.datapath}/${this.getFileName()}`)
       
        try {
            let data_to_write = JSON.stringify(this.data, null, 4)
            fs.writeFileSync(filepath, data_to_write) 
        } catch(e) {
            console.error(`An error occurred while writing the data: ${e.message}`);
            console.error("Stack trace:", e.stack);
        }
    }
    

    getFileName() {
        if (this.data.node.type) {
            return `${this.hash(this.data.node.name, this.data.node.type)}.json`    
        } 
        
        return `${this.hash(this.data.node.name)}.json`    
        
    }

    async getData(args) {

        this.data.node = { 
            key: this.hash(args.value, args.type),  
            name: args.value, 
            type: args.type 
        }

        let filepath = path.join(__dirname, `${this.datapath}/${this.getFileName()}`)
    

        // check if there is data in cache
        if (fs.existsSync(filepath)) {
            let data = fs.readFileSync(filepath)
            data = JSON.parse(data)
            return data
        }
                
        // otherwise retrieve and transform data from endpoint
        let response = await this.fetchItems()
        
       
        if (response) 
            return response

        // await this.clean()  
        await this.transform()
        //let nodeData = await this.fetchNodeFeatures()
        //await this.transformNode(nodeData)
        
        await this.write()

        return this.data
    }

    hash() {
       
        let string = Object.values(arguments).join('--')

        return crypto.createHash('sha256').update(string).digest('hex')
    }
}

module.exports = {
    Transform: Transform
}
 