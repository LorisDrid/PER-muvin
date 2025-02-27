class StreamGraph extends Profile {
    constructor() {
        super()
    }

    async setStack() {
        this.stack
            .offset(d3.stackOffsetSilhouette)
            .order(d3.stackOrderNone)
    }

    getHeight(d) {
        // Récupérer la hauteur de base depuis l'axe Y
        let height = this.chart.yAxis.getStep(d) // reference height for the wave
        
        // Réduire la hauteur en fonction du nombre de nœuds
        const totalNodes = this.chart.data.getNodesKeys().length;
        
        // Coefficient de réduction - plus il y a de nœuds, plus on réduit
        let reductionFactor = 1.0;
        
        if (totalNodes > 1) {
            // Réduire progressivement la hauteur à mesure que le nombre de nœuds augmente
            // Pour 2 nœuds: 0.8, 3 nœuds: 0.7, 4 nœuds: 0.6, etc.
            reductionFactor = Math.max(0.3, 0.9 - ((totalNodes - 1) * 0.1));
        }
        
        // Appliquer le coefficient de réduction
        height = height * reductionFactor;
        
        // Logique conditionnelle existante
        if (!this.chart.getNodeSelection()) // no selected node
            return height * 0.6
             
        if (this.chart.isSelected(d) && this.chart.data.getNodesKeys().indexOf(d) === 0) // the given node is selected and it is the first one in the list
            return height * 0.5
        
        return height * 0.5
    }

    getExtent(){
        // compute min and max height of waves
        let min = 1000, max = -1000;
        this.data.forEach(d => {
            d.data.forEach(item => {
                item.forEach(e => {
                    let min_e = d3.min(e),
                        max_e = d3.max(e);
                    if (min > min_e) min = min_e;
                    if (max < max_e) max = max_e;
                })
            })
        })

        return [min, max]
    }

    setArea(d, key) {
        let height = this.getHeight(key)
        this.heightScale.range([-height, height]) // changes for each node
        return this.area(d)
    }

}