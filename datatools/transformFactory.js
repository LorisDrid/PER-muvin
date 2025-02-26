const { Transform } = require('./transform')
const { CroboraTransform } = require('./croboraTransform')
const { ArtworkTransform } = require('./artworkTransform');
const { RestitutionTransform} = require('./restitutionTransform');
const {ArtScamsTransform} = require('./ArtScamTransform');

class TransformFactory extends Transform {
    constructor() {
        super();
    }

    static getTransform(app, data) {
        switch (app) {
            case 'crobora':
                return new CroboraTransform(app, data);
            case 'artwork':
                return new ArtworkTransform(app, data);
                case 'restitution':
                    return new RestitutionTransform(app, data);
                case 'artscam':
                    return new ArtScamsTransform(app, data);
            default:
                return new Transform(app, data);
        }
    }
}

module.exports = {
    TransformFactory: TransformFactory
}