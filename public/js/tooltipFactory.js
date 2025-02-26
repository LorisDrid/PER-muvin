

class TooltipFactory {
    static getTooltip(app) {
        switch (app) {
            // case 'hal':
            //     return new PublicationsTooltip() // tuned for publications data
            // case 'wasabi':
            //     return new MusicTooltip() // tuned to display artist information from wasabi
            case 'crobora':
                return new ImageTooltip() // tuned to display images
            case 'artscam':
                return new ArtScamTooltip() // spécifique pour ArtScams avec coloration des rôles
            default:
                return new Tooltip() // default tooltip, generated from metadata
        }
    }
}