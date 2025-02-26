class ArtScamTooltip extends Tooltip {
    constructor() {
        super();
        console.log("ArtScamTooltip constructor called");
    }

    // Surcharge de la méthode show pour centrer la tooltip
    show(event, id, width = 400) {
        let tooltip = this.chart.shadowRoot.querySelector(`#${id}-tooltip`);
        tooltip.style.display = 'block';
        
        // Set a fixed minimum width to comfortably fit 3 nodes
        const minWidth = Math.min(550, window.innerWidth * 0.9);
        
        // Positionner la tooltip au milieu de l'écran plutôt qu'à la position du curseur
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Appliquer les styles pour afficher la tooltip
        d3.select(tooltip)
            .styles({
                'width': `${minWidth}px`,
                'min-width': `${minWidth}px`,
                'max-width': `${minWidth}px`, // Ensure consistent width
                'position': 'fixed',
                'left': `${(windowWidth - minWidth) / 2}px`,
                'top': `${windowHeight * 0.3}px`, // Positionnée à 30% du haut de l'écran
                'pointer-events': 'auto', // Permettre l'interaction avec la tooltip
                'z-index': '9999',
                'background-color': 'white',
                'border': '1px solid #ccc',
                'box-shadow': '0 2px 10px rgba(0,0,0,0.2)',
                'padding': '20px',
                'border-radius': '4px',
                'overflow-y': 'auto',  // Permettre le défilement vertical uniquement
                'overflow-x': 'hidden', // Empêcher le défilement horizontal
                'max-height': `${windowHeight * 0.7}px`  // Limiter la hauteur à 70% de la fenêtre
            });
        
        // Add a close button to the tooltip
        const closeButton = document.createElement('div');
        closeButton.innerHTML = '✕';
        closeButton.style.cssText = 'position:absolute;top:16px;right:16px;cursor:pointer;font-size:16px;';
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide(id);
        });
        
        // Make sure we don't add multiple close buttons
        const existingButton = tooltip.querySelector('.tooltip-close-btn');
        if (existingButton) {
            existingButton.remove();
        }
        
        closeButton.classList.add('tooltip-close-btn');
        tooltip.appendChild(closeButton);
        
        // Add click handler to prevent tooltip closing when clicking inside it
        tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
        }, { once: false });
    }

    // Helper function to remove parentheses and their content
    removeParentheses(str) {
        return str.replace(/\s*\([^)]*\)/g, '');
    }

    setItemContent(d, id) {
        console.log("ArtScamTooltip.setItemContent called with data:", d);
        
        // Code spécifique pour artscam avec coloration des rôles
        const itemName = `<b style="font-size: 18px;">${d.title} (${d.year})</b>`;
        const type = `<b>Document type:</b> ${d.type}`;
        const description = d.description ? 
            `<div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 4px; border-left: 3px solid #ddd;">
                ${d.description.length > 200 ? d.description.substring(0, 200) + '...' : d.description}
            </div>` : '';
        const more = `<div style="text-align: center; margin: 30px 0 15px 0;">
            <a href="${d.link}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: #4682B4; color: white; text-decoration: none; border-radius: 4px;">
                View Source
            </a>
        </div>`;

        // Couleurs pour les différents rôles avec les rôles simplifiés
        const roleColors = {
            // Rôles sociaux
            'host': '#e41a1c',           // Rouge
            'guest': '#377eb8',          // Bleu
            'venue': '#4daf4a',          // Vert
            
            // Rôles commerciaux
            'seller': '#ff7f00',         // Orange
            'buyer': '#d4b70d',          // Jaune doré/plus foncé
            'enforcer': '#a65628',       // Brun
            'agent': '#8b4513',          // Brun foncé
            'expert': '#f781bf',         // Rose
            
            // Rôles de publication
            'author': '#999999',         // Gris
            'authority': '#9467bd',      // Violet foncé
            'publisher': '#1e90ff',      // Bleu dodger
            'financier': '#b87333',      // Cuivre
            
            // Rôles d'objet
            'artwork': '#32cd32',        // Vert clair
            'artist': '#dc143c',         // Rouge cramoisi
            'subject': '#00bfff',        // Bleu ciel
            'location': '#2e8b57'        // Vert de mer
        };

        const getRoleColor = (role) => roleColors[role] || '#000000';
        
        let keys = this.chart.data.getNodesKeys();
        
        // Créer un ensemble de tous les rôles uniques présents
        const uniqueRoles = [];
        
        // Si nous avons encore les entités originales
        if (d.entities && d.entities.length > 0) {
            // Utiliser les entités pour déterminer les rôles
            d.entities.forEach(entity => {
                if (entity.role && !uniqueRoles.includes(entity.role)) {
                    uniqueRoles.push(entity.role);
                }
            });
        } 
        // Sinon utiliser les rôles stockés dans contributors
        else if (d.contributors) {
            d.contributors.forEach(contributor => {
                if (contributor.role && !uniqueRoles.includes(contributor.role)) {
                    uniqueRoles.push(contributor.role);
                }
            });
        }
        
        // Créer la légende des rôles si nous en avons, avec une meilleure mise en page
        const legend = uniqueRoles.length > 0 ? 
            `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0; justify-content: center;">
                ${uniqueRoles.map(role => 
                    `<span style="color: ${getRoleColor(role)}; background-color: rgba(0,0,0,0.05); 
                             padding: 5px 10px; border-radius: 3px; white-space: nowrap; font-size: 13px;">${role}</span>`
                ).join('')}
            </div>` : '';

        // Fonction pour obtenir le rôle d'une entité
        const getEntityRole = (entityName) => {
            // Vérifier d'abord dans les entités originales
            if (d.entities) {
                const entity = d.entities.find(e => e.value === entityName);
                if (entity && entity.role) {
                    return entity.role;
                }
            }
            
            // Ensuite vérifier dans les contributors
            if (d.contributors) {
                const contributor = d.contributors.find(c => c.name === entityName);
                if (contributor && contributor.role) {
                    return contributor.role;
                }
            }
            
            return 'unknown';
        };

        // Formater la liste des contributeurs avec couleurs selon rôles, en grille
        // Force exactly 3 columns with equal width and REMOVE the role text
        const contributors = `<div style="margin-top: 24px; margin-bottom: 12px;"><b>Participants (${d.contnames.length}):</b></div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 10px;">
                ${d.contributors.map(val => {
                    const role = getEntityRole(val.name);
                    const color = getRoleColor(role);
                    
                    // Remove parentheses and their content from the name
                    const cleanName = this.removeParentheses(val.name);
                    
                    // Name will now wrap if too long and not cause horizontal overflow
                    // Removed the role text line, keeping only the color coding
                    return `<div style="padding: 10px; border-radius: 4px; background-color: rgba(0,0,0,0.02); overflow: hidden;" title="${val.name} (${role})">
                        <div style="color: ${color}; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${keys.includes(val.key) ? 
                                `<b><i>${this.capitalizeFirstLetter(cleanName)}</i></b>` : 
                                this.capitalizeFirstLetter(cleanName)}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        // Structure finale avec un style amélioré et des marges verticales entre les sections
        this.setContent(`
            <div style="text-align: center; margin-bottom: 24px;">${itemName}</div>
            ${legend}
            <div style="margin: 24px 0;">${type}</div>
            ${description}
            ${contributors}
            ${more}
            <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #999;">
                Click outside or the ✕ to close
            </div>
        `, id);
    }

    setNodeContent(d, id) {
        let value = this.chart.data.getNodeById(d);
        
        // Remove parentheses and their content from the node name
        const cleanName = this.removeParentheses(value.name);
    
        let content = `<div style="text-align: center; margin-bottom: 24px;">
            <b style="font-size: 18px;">${cleanName}</b>
        </div>`;
        
        if (value.nodeLink) {
            content += `<div style="text-align: center; margin: 24px 0;">
                <a href="${value.nodeLink}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: #4682B4; color: white; text-decoration: none; border-radius: 4px;">
                    View External Source
                </a>
            </div>`;
        }
        
        content += `<div style="margin-top: 24px;">
            <div style="margin-bottom: 12px;"><b>${value.collaborators.length}</b> relationships in total</div>
            <div><b>${this.getVisibleCollaborators(value).length}</b> relationships in this network</div>
        </div>
        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #999;">
            Click outside or the ✕ to close
        </div>`;

        this.setContent(content, id);
    }

    // Helper pour capitaliser la première lettre
    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    getVisibleCollaborators(d) {
        let nodes = Object.keys(this.chart.data.getNodes());
        return d.collaborators.filter(e => e.key !== d.key && nodes.includes(e.key));
    } 
}