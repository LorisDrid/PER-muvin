class Muvin extends HTMLElement {
    constructor () {
        super()
        this.attachShadow({ mode: "open" })

        this.svg = null
        this.width = null
        this.height = null
        this.margin = { top: 30, right: 50, bottom: 30, left: 150 }

        this.visibleNodes = null
        this.visibleItems = null
        this.visibleProfile = null

        this.showItems = true

        this.separator = '--' // to treat the query parameters
    }

    async connectedCallback() {
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // Treat query parameters
        this.app = this.getAttribute("app")
        this.token = this.getAttribute("token")

        this.query = this.getAttribute("query")
        this.endpoint = this.getAttribute("endpoint")
        this.hashCode = this.getAttribute("hashCode")

        let value = this.getAttribute("value")
        let type = this.getAttribute("type") // this is mainly used by CROBORA, as the data has a type and a label

        let values = []
        if (value) {
            value = value.split(this.separator)
            type = type ? type.split(this.separator) : null
            value.forEach( (d,i) => {
                let v = { value: d.trim() }
                if (type)
                    v.type = type[i].trim()

                values.push(v)
            })
        }

        let appNodes = {'hal': 'author', 'wasabi': 'artist', 'crobora': 'keyword'}

        let welcomeMessage = ''
        if (this.app === "preview" && !this.query)
            welcomeMessage =  `<p>This page requires a SPARQL query and endpoint as parameter. Use it via <a href="https://dataviz.i3s.unice.fr/ldviz/">LDViz.</p>`
        else if (this.app !== "preview")
            welcomeMessage = `<p>Search for a ${appNodes[this.app]} to begin.</p>`
        this.shadowRoot.querySelector('#message-app').innerHTML =  welcomeMessage
            
        /////////

        this.baseUrl = ''
        this.url = this.baseUrl + `/muvin/${this.app}`

        this.div = d3.select(this.shadowRoot.querySelector('div.timeline'))

        this.defaultWidth = this.width = this.div.node().clientWidth
        
        this.svg = this.div.select('svg#chart')

        this.group = this.svg.select('g#chart-group')
            .attr('transform', `translate(0, ${this.margin.top})`)

            d3.select(this.shadowRoot).on('click', (e) => {
                // Close context menus for all apps
                this.shadowRoot.querySelectorAll('div.context-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
                
                // Only add tooltip closing behavior for artscam app
                if (this.app === "artscam") {
                    // Close tooltips when clicking outside nodes/tooltips
                    const target = e.target;
                    const isTooltip = target.closest('.tooltip');
                    const isNode = target.closest('.doc') || target.closest('.item-circle');
                    
                    if (!isTooltip && !isNode) {
                        this.tooltip.hideAll();
                        // Reset current item in NodesGroup
                        if (this.nodes && this.nodes.currentItemId) {
                            this.nodes.currentItemId = null;
                        }
                    }
                }
            })
        
        this.data = new DataModel(this.app, {query: this.query, endpoint: this.endpoint, token: this.token})

        /// init chart elements
        this.xAxis = new TimeAxis() // temporal axis formed by years
        this.yAxis = new NodesAxis() // axis formed by authors/artists names (nodes of the first level of the network)

        this.legend = new Legend() // color legend for links (different types) and items (nodes of the second level of the network)
        this.legend.init()

        this.nodes = this.app === 'crobora' ? new ImageNodes() : new NormalNodes()
        this.nodes.set()
        
        this.fstlinks = new LinksGroup()
        this.sndlinks = new NodeLinksGroup()
        this.sndlinks.set()

        this.profiles = new StreamGraph()

        this.tooltip = TooltipFactory.getTooltip(this.app)
        this.tooltip.hideAll()

        this.menu = new Menu()
        this.menu.init()

        if (this.searchHidden || this.app === "preview") this.menu.hideSearchFor() 
        
        if (values.length) { 
            if (values.length > 10) { // over 10 nodes, hide items to reduce visual clutter (TODO: calibrate this information through a stylesheet)
                this.showItems = false 
            }
            this.showItems = false
            this.menu.toggleDisplayItems(this.showItems)
            this.data.load(values)
        } 

        //this.test()

    }

    showLoading() {
        this.shadowRoot.querySelector('#loading').style.display = "block";
    }

    hideLoading() {
        this.shadowRoot.querySelector('#loading').style.display = "none";
    }

    getToken() {
        return this.token;
    }

    /**
     * Launch test with HAL data
     */
    async test() {
        let values = [];

        this.showItems = false
        this.menu.toggleDisplayItems(this.showItems)
        
        switch(this.app) {
            case 'crobora':
                values = [{value: 'Angela Merkel', type: 'celebrity'}]
                    // {value: 'Nicolas Sarkozy', type: 'celebrity'}, 
                    // {value: 'Europe', type: 'event'}, 
                    // {value: 'Charles Michel', type: 'celebrity'}]
                break;
            case 'hal':
                //values = [{value: 'Aline Menin'}]
                values = [
                    {value: 'Aline Menin'}, 
                    {value: 'Marco Winckler'}, 
                    {value: 'Olivier Corby'}
                    //{value: 'Alain Giboin'}, 
                    //{value: 'Philippe Palanque'}
                    //{value: "Anne-Marie Déry-Pinna"}
                ]
                // values = ['Marco Winckler', 'Philippe Palanque', 'Thiago Rocha Silva', 'Lucile Sassatelli', 'Célia Martinie', 'Aline Menin']
                break;
            case 'wasabi':
                values = [{value: 'Queen'}, {value: 'Freddie Mercury'}, {value: "David Bowie"}]
                //values = [{value: 'Queen'}]
                break;
        }
        this.data.load(values)
        //values.forEach(async (d) => await this.data.add(d))
    }


    clear() {
        this.shadowRoot.querySelector('.welcome-text').style.display = 'block'
        this.shadowRoot.querySelector('#display-items-info').style.display = 'none'
        this.menu.hideViewSettings()
        this.legend.hide()
        this.div.style('display', 'none')
    }


    /**
     * Update the view when adding or removing a node from the network
     * @param {} focus An object defining the node on focus 
     */
    async update(focus){
        
        if (this.data.isEmpty()) {
            this.clear()
            return
        }

        this.shadowRoot.querySelector('#display-items-info').style.display = 'block'

        this.div.style('display', 'flex')
        this.shadowRoot.querySelector('.welcome-text').style.display = 'none'
        this.hideLoading()
        this.menu.displayViewSettings()

        d3.select(this.shadowRoot.querySelector('#nodes-group'))
            .selectAll('g.artist')
            .data(this.data.getNodesKeys())
            .join(
                enter => enter.append('g')
                    .classed('artist', true)
                    .attr('opacity', 1),
                update => update,
                exit => exit.remove()
            )
        
        this.visibleNodes = [...this.data.getNodesKeys()]
        this.visibleProfile = [...this.visibleNodes]
        this.visibleItems = [...this.visibleNodes]

        this.menu.updateItemsSearch()
        this.menu.updateTimeFilter()

        this.height = this.shadowRoot.querySelector('.timeline').clientHeight

        this.legend.update()
        this.xAxis.set()
        this.yAxis.set()
        await this.profiles.set()
        
        this.yAxis.drawLabels()
        this.xAxis.drawLabels()
        this.xAxis.drawSlider()

        if (this.yAxis.focus && focus && this.yAxis.focus != focus) 
            this.yAxis.setDistortion(focus)
        else if (this.getTimeSelection()){
            let previousFocus = [...this.xAxis.focus]
            this.xAxis.clearFocus()
            previousFocus.forEach(async (d) => await this.xAxis.computeDistortion(d))
            this.xAxis.setDistortion()
        }
        else {
            if (this.visibleNodes.length > 10) { // over 10 nodes, hide items to reduce visual clutter (TODO: calibrate this information through a stylesheet)
                this.showItems = false 
            }
            this.menu.toggleDisplayItems(this.showItems)
            this.draw()
        }
            
    }

    draw() {

        this.width = this.xAxis.range()[1]
       
        this.svg.attr('height', this.height).attr('width', this.width)

        this.profiles.draw()
        this.nodes.draw()
        this.fstlinks.draw()

        
    }

    getDefaultWidth() {
        return this.defaultWidth
    }

    getData() {
        return this.data;
    }

    updateItemsDisplay(display) {
        this.showItems = display;
        this.draw()
    }

    /**
     * Verify whether the global option for drawing items is active
     * 
     * @returns true or false
     */
    drawItems() {
        return this.showItems
    }

    areItemsVisible(key) {
        return this.visibleItems.includes(key)
    }

    displayItems(d) {
        this.visibleItems.push(d)
    }

    removeItems(d) {
        let index = this.visibleItems.indexOf(d)
        if (index > -1) this.visibleItems.splice(index, 1)
        return index
    }

    isNodeVisible(key){
        return this.visibleNodes.includes(key)
    }

    isNodeValid(node){
        return this.data.isNodeValid(node)
    }

    displayNode(d) {
        this.visibleNodes.push(d)
    }

    isProfileVisible(key) {
        return this.visibleProfile.includes(key)
    }

    displayProfile(d) {
        this.visibleProfile.push(d)
    }

    removeProfile(d) {
        let index = this.visibleProfile.indexOf(d)
        if (index > -1) this.visibleProfile.splice(index, 1)
        return index
    }

    isProfileActive(d) {
        let key = d.data.node.key
        if (!this.isNodeVisible(key)) return 0
        if (this.isProfileVisible(key)) return 1;
        if (!this.getNodeSelection() && this.isProfileVisible(key) || (this.isProfileVisible(key) && this.getNodeSelection() && this.isSelected(key))) return 1
        return 0
    }

    getItemColor() {
        return this.data.colors.item;
    }

    getTypeValue(key) {
        return this.data.linkTypes[key]
    }

    getTypeColor(key) {
        return this.data.colors.typeScale(key)
    }

    /**
     * 
     * @param {*} d a link between two nodes 
     * @returns a boolean indicating whether that link is uncertain or not
     */
    async isUncertain(d) {        
        let items = await this.data.getItems().filter(a => a.id === d.item.id && a.year === d.year)
        let foundInSource = items.some(a => a.node.key === d.source)
        let foundIntarget = items.some(a => a.node.key === d.target)

        return !(foundInSource && foundIntarget)
    }

    // return chart dimensions
    getDimensions() {
        return { left: this.margin.left, right: this.margin.right, top: this.margin.top, bottom: this.margin.bottom, width: this.width, height: this.height }
    }

    ////////
    getNodeSelection() {
        return this.yAxis.focus
    }

    async updateVisibleNodes(){ // according to yAxis focus
        
        let keys = this.data.getNodesKeys()
        let index = keys.indexOf(this.yAxis.focus)
        let nodes = index === -1 || !this.yAxis.focus ? keys : [this.yAxis.focus]

        if (index === 0) {
            nodes.push(keys[index + 1])
            nodes.push(keys[index + 2])
        } else if (index === keys.length - 1) {
            nodes.push(keys[index - 1])
            nodes.push(keys[index - 2])
        } else {
            nodes.push(keys[index - 1])
            nodes.push(keys[index + 1])
        }

        this.visibleItems = [...nodes]
        this.visibleProfile = [...nodes]
    }

    getTimeSelection() {
        return this.xAxis.focus.length;
    }

    /**
     * Verify whether a node or a time period is selected
     * 
     * @param {d} d data record 
     * @returns true or false
     */
    isSelected(d) {
        return this.yAxis.focus === d || this.xAxis.focus.includes(+d)
    }

    isFreezeActive() {
        return this.yAxis.freeze
    }

    isFrozen(id) {
        return this.yAxis.frozenNodes && this.yAxis.frozenNodes.snd.includes(id)
    }

    /**
     * Function that provides the list of items affected by the selected node (mouseover or freeze)
     * @param   {String} d selected label on the y axis
     * @return  {Object} keys: "snd" list of ids of second level nodes, "fst" list of first level nodes 
     */
    async getConnectedNodes(d) {
        let value = d || this.yAxis.freeze;

        if (!value) return

        let targets = this.data.links.filter(e => e.source.key === value || e.target.key === value).map(e => e.target.key === value ? e.source.key : e.target.key)
        targets =  targets.filter((e,i) => this.yAxis.values.includes(e) && targets.indexOf(e) === i)

        let items = await this.data.getItems()
        let nodes = items.filter(e => {
            let values = e.contributors.map(x => x.key)
            return values.includes(value) && values.some(a => targets.includes(a)) 
        })

        nodes = nodes.map(e => e.parent ? [e.id, e.parent.id] : e.id).flat()
        nodes = nodes.filter( (e,i) => nodes.indexOf(e) === i )

        return { snd: nodes, fst: targets } 
        
    }

    isPlayable(d){
        return this.data.nodes[d].audio
    }

    /**
     * Function that sets the focus on the selected node (artist/author)
     * @param {String} d selected label on the y axis
     */
    focusOnNode(d) {
        if (!this.isSelected(d) && this.data.getNodesKeys().length > 1) {
            this.yAxis.setDistortion(d)
        }
    }

    async releaseNodeFocus(d) {
        this.yAxis.setDistortion(d)    
    }

    focusOnTime(value) {
        if (this.getTimeSelection()) this.xAxis.setDistortion(value)
        
        else this.xAxis.setSliderPosition(this.xAxis.timeScale(value) - this.xAxis.getStep(value) / 2, value)
    }

    releaseTimeFocus(d) {
        this.xAxis.setDistortion(d)
    }
   

   

}

const template = document.createElement("template");
template.innerHTML = `

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    
    <link rel="stylesheet" href="/muvin/css/header.css">
    <link rel="stylesheet" href="/muvin/css/dropdown.css">
    <link rel="stylesheet" href="/muvin/css/timeline.css">
    <link rel="stylesheet" href="/muvin/css/legend.css">
    <link rel="stylesheet" href="/muvin/css/menu.css">
    <link rel="stylesheet" href="/muvin/css/search.css">
    <link rel="stylesheet" href="/muvin/css/timeslider.css">

    <div class='loading' id='div-loading'></div>
    <div class='tooltip' id='cluster-tooltip'></div>
    <div class='tooltip' id='item-tooltip'></div>
    <div class='tooltip' id='node-tooltip'></div>
    <div class='tooltip' id='profile-tooltip'></div>
    
    <div class='welcome-text'>
        <h3>Welcome to <b>Muvin</b>. </h3>
        
        <div id='message-app'></div>
    </div>

    <div class="menu">
        
        <h3>Muvin</h3>

        <div id='menu-items' class='settings' >
            <div id="search-for" class='section'>
                <label>Search for</label>
                <input type="text" list='nodes-list' id="nodes-input" placeholder="Type here">
                <datalist id='nodes-list'></datalist>
                <button id="search-go">Go</button>
            </div>

            <div id="view-options" style='display: none;'>
                

                <div class = 'section'>
                    <label >Search items</label>
                    <input type="text" list='items-list' id="items-input" placeholder="Type here">
                    <button id='items-input-clear'>Clear Search</button>
                    <datalist id='items-list'></datalist>
                    
                </div>

                <div class="dropdown"  >
                    
                    <button class="dropbtn" id='time-button'>Filters</button>

                    <div id="timeDropdown" class="dropdown-content">

                        <div class='timePeriod'>
                            <label>Time</label>
                            <label class='time-info' id='from-label'> </label>

                            <div style='width:400px; position:relative;'>
                                <span class="multi-range">
                                    <input type="range" min="0" max="50" value="5" id="lower">
                                    <input type="range" min="0" max="50" value="45" id="upper">
                                </span>

                                <!-- Dynamic labels for current slider values -->
                                <span id="lower-value" class="slider-value"></span>
                                <span id="upper-value" class="slider-value"></span>
                            </div>
                            
                            <label class='time-info' id='to-label'> </label>
                        </div>

                        <div>
                            <div>
                                <input type="checkbox" id="display-items" style="transform: scale(.5);">
                                <label >Display Items</label> 
                            </div>
                        </div>
                    </div>
                </div>
                    
                <div style='gap:10px;'>
                    <button id="clear-network">Clear Network</button>
                    <button id="clear-cache">Clear Cache</button>
                </div>
            </div>
        </div>
    </div>

    <div class="vis">
        <div class='import-form'>
            <div id='topbar'>
                <label id='title'></label>
                <image src='/muvin/images/close.svg'></image>
            </div>
            <div>
                <label>Sort by</label>
                <select class='sort'></select>
            </div>
            <div>
                <label>Search for</label>
                <input class='search' type='text' id='ul-search' placeholder='Enter value here'></input>
            </div>
            <ul class='values' id='ul-multi'></ul>

            <button type='button'>Submit</button>
        </div>

        <div id="loading">  
            <img width="70px" height="70px" src="/muvin/images/loading.svg"></img>
            <p>Loading data...</p>
        </div>

       

        
            <div class='legend'>  </div>
            <div id="display-items-info" style="position:relative; top: 90px; font-size: 12px; display: none;">
                <p><b>Obs.:</b> You can display/hide the circles by using the filters.
            </div>
            <div class='timeline'>
                <div class='nodes-panel'>
                    <svg>
                        <text id='node-count'></text>
                        <g id='labels-group'></g>
                    </svg>
                </div>

                <svg id="chart">
                    <g id ='chart-group'>
                        <g id='top-axis' class='timeaxis' >
                            <line></line>
                        </g>
                        <g id='bottom-axis' class='timeaxis' >
                            <line></line>
                        </g>
                        
                        <g id="membership-links-group"></g>
                        <g id='link-group'></g>
                        

                        <g id='nodes-group'></g>
                        <g id='ticks-group'></g>

                        <g id='x-slider'>
                            <rect class='marker move'></rect>
                            <rect id='top-button' class='slider-button move'></rect>
                            <text></text>
                            <rect id='bottom-button' class='slider-button move'></rect>
                        </g>
                        <g id='y-slider'>
                            <image id="slider-up"  ></image>
                            <image id="slider-down" ></image>
                        </g>

                        <g id='nodeLinks-group'> </g>

                    
                        
                    </g>
                </svg>
            </div>

       
        
    </div>
    `

customElements.define("vis-muvin", Muvin);