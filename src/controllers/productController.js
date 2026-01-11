
const { QuoteRequest } = require('../helpers/quoteRequestHelper.js')
const db = require('../models/db.js')
const utils = require('../../utils')
const { SampleRequest } = require('../helpers/sampleRequestHelper.js')



const productSampleRequest = async (req, res) => {
    if (!req.params?.endpoint || !['sample', 'quote'].includes(req.params?.route))
        return res.status(401).json({ msg: "Invalid route or endpoint" })

    const endpoint = req.params.endpoint
    switch (req.params?.route) {
        case 'sample':
            const sample = new SampleRequest(db, endpoint, req, res)
            typeof sample[endpoint] === 'function' ?
                await sample.callMethods() :
                res.status(400).send(utils.responseError("Method not implemented", 400))
            break
        case "quote":
            const quote = new QuoteRequest(db, endpoint, req, res)
            typeof quote[endpoint] === 'function' ?
                await quote.callMethods() :
                res.status(400).send(utils.responseError("Method not implemented", 400))
            break

    }
}



module.exports = {
    productSampleRequest
}



