class DataModel {
    constructor(app, obj) {
        this.chart = document.querySelector('#muvin')
        this.app = app

        this.clusters = []
        this.items = []
        this.nodes = {}
        this.links = []
        this.linkTypes = []

        this.filters = {
            linkTypes: [],
            timeFrom: null,
            timeTo: null,
            focus: null
        }

        this.colors = { 
            item: '#ccc',
            typeScale: d3.scaleOrdinal(d3.schemeSet2)
        }

        Object.assign(this, obj)
        console.log(this)

        if (this.app !== 'preview') this.fetchNodesLabels(this.app)

        this.route = this.chart.baseUrl + '/muvin/data/' + this.app

    }


    async fetchData(node) {
      
        let body = { query: this.query, endpoint: this.endpoint, value: node.value || node.name, type: node.type, hashCode: this.chart.hashCode } 
        
        let response = fetch(this.route, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        }).then(response => {
            return response.json()
        }).catch(error => {
            alert(error);
        })

        return response
    }

    async fetchNodesLabels(value) {
        const response = await fetch(this.chart.baseUrl + '/muvin/data/' + value + '/nodes')
        this.nodeLabels = await response.json()
        
    }

    async clear() {
        this.clusters = []
        this.items = []
        this.nodes = {}
        this.links = []
        this.linkTypes = []
    }

    isEmpty() {
        return this.items.length === 0
    }

    async remove(node, focus) {
        
        delete this.nodes[node];
        this.items = this.items.filter(d => d.node.key !== node)

        await this.load(await this.getNodesList())
       
    }

    async reload() {
        let nodes = await this.getNodesList()
       
        await this.clear()
        await this.load(nodes)
    }

    async load(values) {    

        this.chart.showLoading()

        let errormessages = []
        let response;
        for (let node of values) {   
           
            response = await this.fetchData(node)
            
            if (response && response.message) {
                errormessages.push(response.message)
            } else 
                await this.update(response)
        }

        await this.updateTime()
        await this.updateLinkTypes()
        
        await this.chart.update()

        if (errormessages.length)
            alert(errormessages.join('\n'))
       
    }

    // updates

    async update(data) {

        this.nodes[data.node.key] = data.node 

        await this.updateItems(data.items)

        await this.updateLinks()

        await this.updateCollaborations(data.node.key)

        return
    }

    async updateItems(items) {
        
        if (items) { // if new items
            items.forEach(d => { d.year = +d.year })
            this.items = this.items.concat(items)
        }

        // sort items according to the order of nodes, to calculate links
        let nodes = Object.keys(this.nodes)
        this.items.sort( (a,b) => nodes.indexOf(a.node.key) - nodes.indexOf(b.node.key) )

        return
    }



    async updateFilters(type, values) {
        this.filters[type] = values
    }

    getFiltersByType(type){
        return this.filters[type];
    }

    getFocus() {
        return this.filters.focus
    }

    async updateLinkTypes() {
        this.linkTypes = this.items.map(d => d.type).filter(d => d).flat()
        this.linkTypes = this.linkTypes.filter( (d,i) => this.linkTypes.indexOf(d) === i)

        this.colors.typeScale.domain(this.linkTypes)
    }

    async updateTime() {
        // Obtenir tous les items
        let items = await this.getItems('nofilter')
        
        // Utiliser getAllDates() pour garantir une séquence complète
        this.dates = this.getAllDates()
        
        // Définir les filtres de temps basés sur la plage complète
        if (this.dates.length > 0) {
            this.filters.timeFrom = this.dates[0]
            this.filters.timeTo = this.dates[this.dates.length - 1]
        } else {
            this.filters.timeFrom = null
            this.filters.timeTo = null
        }
    }

    async updateCollaborations(key) {
        
        let items = this.items.filter(d => d.node.key === key)
        let collaborators = items.map(d => d.contributors).flat()

        collaborators = collaborators.filter( (d,i) => collaborators.findIndex(e => e.key === d.key) === i && d.key !== key)
        collaborators = collaborators.map(d => { 
            let values = items.filter(e => e.contnames.includes(d.name))
            return { ...d, values: values } 
        })

        this.nodes[key].collaborators = collaborators
            

        await this.sortCollaborators('decreasing', key) // alpha, decreasing (number of shared items)
        
        
    }

    async sortCollaborators(value, key) {
        this.nodes[key].sorting = value;

        switch(value) {
            case 'decreasing':
                this.nodes[key].collaborators.sort( (a, b) => { 
                    if (a.enabled && b.enabled) return b.values.length - a.values.length 
                    if (a.enabled) return -1
                    if (b.enabled) return 1 
                    return b.values.length - a.values.length
                })
                break;
            default:
                this.nodes[key].collaborators.sort( (a, b) => { 
                    if (a.enabled && b.enabled) return a.value.localeCompare(b.value)
                    if (a.enabled) return -1
                    if (b.enabled) return 1 
                    return a.name.localeCompare(b.name)
                }) 
        }

    }

    async updateLinks() {
        this.links = []

        let nestedValues = d3.nest()
            .key(d => d.id)
            .entries(this.items)

        let jointItems = nestedValues.filter(d => d.values.length > 1)

        if (!jointItems.length) return

        for (let item of jointItems) {
           
            for (let v1 of item.values) {
                for (let v2 of item.values) {
                    if (v1.node.key === v2.node.key) continue

                    for (let type of v1.type) {
                        this.links.push({
                            source: v1.node,
                            target: v2.node,
                            type: type,
                            item: item.key,
                            year: v1.year
                        })    
                    }
                }
            }
        }

        return
    }

    // checkers

    isNodeValid(node) {
        return Object.keys(this.nodes).includes(node.key)
    }


    isNodeExplorable(node){
        return this.nodeLabels.some(d => d.type ? d.value === node.name && d.type === node.category : d.value === node.name)
    }

    // getters 

    async getItems() {
        let filter = arguments[0]

        let uniqueKeys = this.items.map(d => d.contributors.map(e => e.key)).flat()
        uniqueKeys = uniqueKeys.filter((d,i) => uniqueKeys.indexOf(d) === i)

        let items = this.items.filter(d => !d.node.contribution.every(e => this.filters.linkTypes.includes(e)) ) // filter out selected link types
        
        if (!filter && this.filters.timeFrom && this.filters.timeTo) {
            items = items.filter(d => d.year >= this.filters.timeFrom && d.year <= this.filters.timeTo)
        }
       
        if (this.filters.focus) {
            let nodes = this.getNodesKeys()

            items = items.filter(d => d.contributors.length > 1 // only collaborative items
                && d.contributors.some(e => e.key === this.filters.focus) // include the author on focus
                && d.contributors.some(e => nodes.includes(e.key) && e.key != this.filters.focus) // every author is visible
                ) 
        }

        return items
    }

    getItemById(key) {
        return this.items.find(d => d.id === key)
    } 

    getLinks() {
       
        let links = this.links.filter(d => !this.filters.linkTypes.includes(d.type) )
      
        if (this.filters.timeFrom && this.filters.timeTo) 
            links = links.filter(d => d.year >= this.filters.timeFrom && d.year <= this.filters.timeTo)
       
        if (this.filters.focus) {
            links = links.filter(d => this.getItemById(d.item).contributors.some(e => e.key === this.filters.focus) )
        }    

        return links
    }

    getLinkTypes() {
        return this.linkTypes
    }


    /// Getters for nodes
    getNodesKeys() {
        return Object.keys(this.nodes);
    }

    async getNodesList() {
        return Object.values(this.nodes)
    }

    getNodes() {
        return this.nodes;
    }

    getNodeById(d) {
        return this.nodes[d]
    }

    async switchNodes(indexA, indexB) {
        let keys =  Object.keys(this.nodes)
        let temp = keys[indexA]
        keys[indexA] = keys[indexB]
        keys[indexB] = temp

        let keysOrder = {}
        keys.forEach(key => { keysOrder[key] = null })

        this.nodes = Object.assign(keysOrder, this.nodes)

        await this.updateItems()
        await this.updateLinks()
    }

    getDates() {
        // Même lorsqu'un filtre de temps est appliqué, nous voulons une séquence complète
        let allDates = this.getAllDates()
        
        // Si des filtres sont appliqués, filtrer la séquence tout en préservant la continuité
        if (this.filters.timeFrom && this.filters.timeTo) {
            return allDates.filter(d => d >= this.filters.timeFrom && d <= this.filters.timeTo)
        }
        
        return allDates
    }
    

    getAllDates() {
        // Récupérer toutes les années de tous les items
        let values = this.items.map(d => +d.year)
        
        // Filtrer les doublons
        values = values.filter((d,i) => values.indexOf(d) === i)
        
        // S'assurer qu'il y a au moins une date
        if (values.length === 0) {
            return []
        }
        
        // Trier les valeurs
        values.sort((a, b) => a - b)
        
        // Créer une liste complète avec toutes les années dans la plage
        const minYear = Math.min(...values) - 1
        const maxYear = Math.max(...values) + 1
        
        const completeYears = []
        for (let year = minYear; year <= maxYear; year++) {
            completeYears.push(year)
        }
        
        return completeYears
    }

    getMatchingLabels(value) {
        let labels = this.nodeLabels.filter(d => d.value.toLowerCase().includes(value))
        labels.sort( (a,b) => a.value.localeCompare(b.value))

        return labels
    }

    getNode(value) {
        return this.nodeLabels.find(d => d.value === value)
    }
}