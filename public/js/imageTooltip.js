class ImageTooltip extends Tooltip{
    constructor() {
        super()

    }

    setItemContent(d, id) { // TO-DO: modify according to crobora data

        const image = `<div style="width: 100%; margin:auto; text-align:center;">
                <a href="${d.link}" target="_blank" style="pointer-events: ${d.link ? 'auto' : 'none'};">
                    <img class="main-image" src=${getImageLink(d.name)} width="250px" title="Click to explore the archive metadata in the CROBORA platform" ></img> </a>
                <br></div>`

        let content = `${image}
                    <p>Archive: <b>${d.parent.name}</b></p>
                    <p>Broadcast date: <b>${d.parent.date}</b></p>
                    <p><b>Broadcaster:</b> ${d.artist.contribution.join(', ')}</p> 
                    <p><b>Keywords(s):</b>
                    <ul style='list-style-type: none;'>
                    ${d.contributors.map(val => `<li title="${val.category}" style="display:flex; gap:10px;"> <img src="/muvin/images/${this.chart.app}/${val.category}-icon.svg" width="15px"></img>${capitalizeFirstLetter(val.name)}</li>` ).join('')}
                    </ul>
                    <br><br><p>Right-click for more</p>
                    `
        this.setContent(content, id); 
    }

    setProfileContent(e, d, id) { 
        let node = d[0].data.artist
        let year = this.chart.xAxis.invert(e.pageX, 1)

        let data = this.chart.data.getItems()
        let values = data.filter(e => e.artist.key === node.key && e.year === year && e.artist.contribution.includes(d.key))
        
        let content = `<img src="/muvin/images/${this.chart.app}/${node.type}-icon.svg" width="15px"></img><b> ${node.name}</b><br><br>
        <b>Broadcaster:</b> ${capitalizeFirstLetter(d.key)}<br><br>
        <b>${year}: ${values.length}</b> image${values.length > 1 ? 's' : ''}`

        this.setContent(content, id)
    }

    setNodeContent(d, id) {
        let value = this.chart.data.artists[d]
        
        let content = `<b>${value.name}</b><br><br>
            Category: <b>${value.type}</b><br>
            <b>${value.collaborators.length}</b> co-occurrences in total<br>
            <b>${this.getVisibleCollaborators(value).length}</b> co-occurrences in this network<br><br>`

        this.setContent(content, id)
    }
}