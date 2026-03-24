const db = require('../models/db')
const utils = require('../../utils')
const axios = require('axios')
const { getCode } = require('country-list')

const TERMINAL_AFRICA_BASE_URL = process.env.TERMINAL_AFRICA_BASE_URL ;
const TERMINAL_AFRICA_SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY ;

const taClient = axios.create({
    baseURL: TERMINAL_AFRICA_BASE_URL,
    headers: { 'Authorization': `Bearer ${TERMINAL_AFRICA_SECRET_KEY}`, 'Content-Type': 'application/json' }
});


const RouteTemplates = db.route_templates

const listTemplates = async (req, res) => {
    const templates = await RouteTemplates.findAll({ order: [['id','ASC']] })
    return res.status(200).send(utils.responseSuccess(templates))
}

const getTemplate = async (req, res) => {
    const id = req.params.id
    const template = await RouteTemplates.findByPk(id)
    if (!template) return res.status(404).send(utils.responseError('Not found'))
    return res.status(200).send(utils.responseSuccess(template))
}

const createTemplate = async (req, res) => {
    const body = req.body
    try {
        const t = await RouteTemplates.create(body)
        return res.status(201).send(utils.responseSuccess(t))
    } catch (err) {
        return res.status(422).send(utils.responseError(err.message))
    }
}

const updateTemplate = async (req, res) => {
    const id = req.params.id
    const body = req.body
    const t = await RouteTemplates.findByPk(id)
    if (!t) return res.status(404).send(utils.responseError('Not found'))
    await t.update(body)
    return res.status(200).send(utils.responseSuccess(t))
}

const deleteTemplate = async (req, res) => {
    const id = req.params.id
    const t = await RouteTemplates.findByPk(id)
    if (!t) return res.status(404).send(utils.responseError('Not found'))
    await t.destroy()
    return res.status(204).send()
}

const matchTemplate = async (req, res) => {
    const { origin_city, destination_city, transport_mode, service_level, weight, pickup_address, delivery_address, items } = req.body
    if (!origin_city || !destination_city || !transport_mode || !service_level || typeof weight === 'undefined')
        return res.status(400).send(utils.responseError('Missing required parameters'))

    // const templates = await RouteTemplates.findAll({
    //     where: {
    //         origin_city: origin_city,
    //         destination_city: destination_city,
    //         transport_mode: transport_mode,
    //         service_level: service_level
    //     }
    // })
    // rather, the above should normalizze both the db values and the req body values to same letter casing first so comparison can work , implement the fix below:
    const templates = await RouteTemplates.findAll()
    const filteredTemplates = templates.filter(t => 
        t.origin_city.toLowerCase() === origin_city.toLowerCase() &&
        t.destination_city.toLowerCase() === destination_city.toLowerCase() &&
        t.transport_mode.toLowerCase() === transport_mode.toLowerCase() &&
        t.service_level.toLowerCase() === service_level.toLowerCase()
    )
    


    for (const t of filteredTemplates) {
        const brackets = t.weight_brackets || []
        for (const b of brackets) {
            const min = Number(b.min || 0)
            const max = Number(b.max || Number.POSITIVE_INFINITY)
            if (weight >= min && weight <= max) {
                return res.status(200).send(utils.responseSuccess({ template: t, match: b }))
            }
        }
    }

    // Fallback: Check External Carriers (Terminal Africa)
    if (pickup_address && delivery_address && items && Array.isArray(items)) {
        try {
            // 1. Create Quick Shipment
            const parcelItems = items.map(item => ({
                name: item.name,
                description: item.description || item.name,
                currency: 'NGN',
                value: Number(item.price) || 0,
                weight: parseFloat(item.weight) || 1,
                quantity: parseInt(item.quantity) || 1
            }));

            const payload = {
                pickup_address: {
                    first_name: pickup_address.contact_name?.split(' ')[0] || 'Sender',
                    last_name: pickup_address.contact_name?.split(' ')[1] || 'User',
                    email: pickup_address.email || 'no-email@example.com',
                    phone: '+' + pickup_address.phone,
                    line1: pickup_address.line1,
                    city: pickup_address.city,
                    state: pickup_address.state,
                    country: getCode(pickup_address.country) || 'NG'
                },
                delivery_address: {
                    first_name: delivery_address.first_name,
                    last_name: delivery_address.last_name,
                    email: delivery_address.email,
                    phone: '+' + delivery_address.phone,
                    line1: delivery_address.line1,
                    city: delivery_address.city,
                    state: delivery_address.state,
                    country: getCode(delivery_address.country) || 'NG'
                },
                parcel: {
                    description: "obana logistics goods",
                    items: parcelItems,
                    weight_unit: 'kg',
                    metadata: {}
                },
                shipment_purpose: 'commercial'
            };
            console.log("PAYLOAD", payload)
            const quickResponse = await taClient.post('/shipments/quick', payload);
            
            if (quickResponse.data && quickResponse.data.status && quickResponse.data.data.shipment_id) {
                const shipmentId = quickResponse.data.data.shipment_id;
                
                // 2. Get Rates
                const ratesResponse = await taClient.get(`/rates/shipment?shipment_id=${shipmentId}&currency=NGN`);
                const rates = ratesResponse.data.data;

                if (rates && rates.length > 0) {
                    // Pick the best rate (simplest logic: first one)
                    const bestRate = rates[0]; 
                    return res.status(200).send(utils.responseSuccess({
                        external: true,
                        shipment_id: shipmentId,
                        rate_id: bestRate.rate_id,
                        carrier: { name: bestRate.carrier_name, logo: bestRate.carrier_logo },
                        match: {
                            price: bestRate.amount,
                            eta: bestRate.delivery_time,
                            min: 0,
                            max: weight,
                            estimated_delivery: bestRate.delivery_time
                        }
                    }));
                }
            }
        } catch (error) {
            console.error('External route match failed:', error?.response?.data || error.message);
        }
    }

    return res.status(404).send(utils.responseError('No routes available for this shipment'))
}

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    matchTemplate
}
