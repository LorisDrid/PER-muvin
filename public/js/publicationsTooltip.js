class PublicationsTooltip extends Tooltip{
    constructor() {
        super()
    }

    setItemContent(d, id) {
        const itemName = `<b>${d.name} (${d.year})</b><br>`
        const type = `<b>Document type:</b> ${d.type}`
        const more = `<br><br>Right-click for more`
        
        const contributors = e => `<b>${e.contnames.length} author(s):</b> ${e.contnames.map(val => capitalizeFirstLetter(val)).join(', ')}`

        this.setContent(`${itemName}<br>${contributors(d)}<br><br>${type}${more}`, id); 
    }

    setProfileContent(e, d, id) {
        let artist = d[0].data.artist
        let year = this.chart.xAxis.invert(e.pageX, 1)

        let data = this.chart.data.getItems()
        let values = data.filter(e => e.artist.key === artist.key && e.year === year && e.artist.contribution.includes(d.key))
        

        let content = `<b> ${artist.name}</b><br><br>
        <b>Publication Type:</b> ${capitalizeFirstLetter(d.key)}<br><br>
        <b>${year}: ${values.length}</b> item${values.length > 1 ? 's' : ''} <br><br>
        Click to keep it highlighted`

        this.setContent(content, id)
    }

    setNodeContent(d, id) {
        let value = this.chart.data.artists[d]
       
        let topic = value.topics ? `<b>Research topics (${value.topics.length}):</b><br> <ul> ${value.topics.map(d => `<li>${d}</li>`).join('')}</ul>` : ''
        
        let content = `<b>${value.name}</b><br>
        <b>${value.collaborators.length}</b> co-authors in total<br>
        <b>${this.getVisibleCollaborators(value).length}</b> co-authors in this network<br><br>
            ${topic}
            `

        this.setContent(content, id)
    }


}