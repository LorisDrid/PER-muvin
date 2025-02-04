const { Transform } = require('./transform')
const { CroboraTransform } = require('./croboraTransform')
const { ProvenanceTransform } = require('./provenanceTransform');

class TransformFactory extends Transform {
    constructor() {
        super();
    }

    static getTransform(app, data) {
        console.log("factory appelée");
        switch (app) {
            case 'crobora':
                return new CroboraTransform(app, data);
            case 'provenance':
                return new ProvenanceTransform(app, data);
            default:
                return new Transform(app, data);
        }
    }
}

module.exports = {
    TransformFactory: TransformFactory
}