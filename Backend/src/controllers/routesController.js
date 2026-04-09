const db = require('../models/db')
const utils = require('../../utils')
const axios = require('axios')
const { getCode } = require('country-list')
const lookup = require('country-code-lookup')

require('dotenv').config()

const TERMINAL_AFRICA_BASE_URL = process.env.TERMINAL_AFRICA_BASE_URL ;
const TERMINAL_AFRICA_SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY ;

const taClient = axios.create({
    baseURL: TERMINAL_AFRICA_BASE_URL,
    headers: { 'Authorization': `Bearer ${TERMINAL_AFRICA_SECRET_KEY}`, 'Content-Type': 'application/json' }
});


const RouteTemplates = db.route_templates
/**
 * Convert a delivery_time string like "Within 7 days" into "MMM D - MMM D"
 * If input doesn't match pattern, return input unchanged.
 */
function deliveryTimeRange(delivery_time) {
  if (typeof delivery_time !== "string") return delivery_time;

  const m = delivery_time.match(/^\s*Within\s+(\d+)\s+days?\s*$/i);
  if (!m) return delivery_time;

  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n < 0) return delivery_time;

  const now = new Date();
  const start = now;

  const end = new Date(now.getTime());
  end.setDate(end.getDate() + n);

  const opts = { month: "long", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", opts);

  return `${startStr} - ${endStr}`;
}

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
    let { origin_city, destination_city, transport_mode, service_level, weight, pickup_address, delivery_address, items } = req.body

    // Detect and normalize complex payload from Salesforce/Shop frontends
    if (req.body.parcel && !origin_city) {
        items = req.body.parcel.items || items;
        delivery_address = req.body.delivery_address || delivery_address;
        
        // Use the first item's pickup address as the reference for route matching if root is missing
        pickup_address = pickup_address || items?.[0]?.pickup_address;

        // derive parameters for template matching
        origin_city = origin_city || pickup_address?.city;
        destination_city = destination_city || delivery_address?.city;
        transport_mode = transport_mode || 'road';
        service_level = service_level || 'Standard';

        // Calculate total weight for bracket matching if not explicitly provided
        if (typeof weight === 'undefined' && items) {
            weight = items.reduce((acc, item) => acc + (parseFloat(item.weight) || 0), 0);
        }
    }

    if (!origin_city || !destination_city || !transport_mode || !service_level || typeof weight === 'undefined')
        return res.status(400).send(utils.responseError('Missing required parameters'))

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

    
    if (pickup_address && delivery_address && items && Array.isArray(items)) {
        try {
            // Group items by pickup address
            const groupedItems = items.reduce((acc, item) => {
                const pickupAddress = item.pickup_address || {};
                const key = JSON.stringify({
                    line1: (pickupAddress.line1 || '').trim().toLowerCase(),
                    line2: (pickupAddress.line2 || '').trim().toLowerCase(),
                    city: (pickupAddress.city || '').trim().toLowerCase(),
                    state: (pickupAddress.state || '').trim().toLowerCase(),
                    country: (pickupAddress.country || '').trim().toUpperCase(),
                    zip: (pickupAddress.zip_code || pickupAddress.zip || '').trim()
                });

                if (!acc[key]) acc[key] = { pickup_address: item.pickup_address, items: [] };
                acc[key].items.push(item);
                return acc;
            }, {});

            const shipmentResults = [];

            for (const group of Object.values(groupedItems)) {
                const parcelItems = group.items.map(item => ({
                    name: item.name,
                    description: item.description || item.name,
                    currency: 'NGN',
                    value: Number(item.price) || Number(item.value) || 0,
                    weight: parseFloat(item.weight) || 1,
                    quantity: parseInt(item.quantity) || 1
                }));

                const payload = {
                    pickup_address: {
                        first_name: group.pickup_address.contact_name?.split(' ')[0] || 'obana',
                        last_name: group.pickup_address.contact_name?.split(' ')[1] || 'africa',
                        email: group.pickup_address.email || 'obana.africa@example.com',
                        phone: (!String(group.pickup_address.phone).startsWith("+") ? '+' + group.pickup_address.phone : group.pickup_address.phone) || "08069331070",
                        line1: group.pickup_address.line1 || "08069331070",
                        city: group.pickup_address.city,
                        state: group.pickup_address.state,
                        country: req.body.parcel ? delivery_address.country : lookup.byCountry(group.pickup_address.country.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())).iso2 || 'NG',
                        zip: group.pickup_address.zip_code
                    },
                    delivery_address: {
                        first_name: delivery_address.first_name,
                        last_name: delivery_address.last_name,
                        email: delivery_address.email,
                        phone: (!String(delivery_address.phone).startsWith("+") ? '+' + delivery_address.phone : delivery_address.phone) || "08069331070",
                        line1: delivery_address.line1,
                        city: delivery_address.city,
                        state: delivery_address.state,
                        country: req.body.parcel ? delivery_address.country : lookup.byCountry(delivery_address.country.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())).iso2 || 'NG',
                        zip: delivery_address.zip_code
                    },
                    parcel: {
                        description: "obana logistics goods",
                        items: parcelItems,
                        weight_unit: 'kg',
                        metadata: {}
                    },
                    shipment_purpose: 'commercial'
                };
                

                const quickResponse = await taClient.post('/shipments/quick', payload);

                if (quickResponse.data && quickResponse.data.status && quickResponse.data.data.shipment_id) {
                    const shipmentId = quickResponse.data.data.shipment_id;

                    const ratesResponse = await taClient.get(`/rates/shipment?shipment_id=${shipmentId}&currency=NGN`);
                    const rates = ratesResponse.data.data;

                    if (rates && rates.length > 0) {
                        const bestRate = rates[0];
                        shipmentResults.push({
                            external: true,
                            shipment_id: shipmentId,
                            rate_id: bestRate.rate_id,
                            carrier: { name: bestRate.carrier_name, logo: bestRate.carrier_logo },
                            items: group.items, // Include the items in this shipment
                            match: {
                                price: bestRate.amount + (10/100),
                                eta: deliveryTimeRange(bestRate.delivery_time),
                                min: 0,
                                max: group.items.reduce((acc, item) => acc + parseFloat(item.weight || 0), 0),
                                estimated_delivery: deliveryTimeRange(bestRate.delivery_time)
                            }
                        });
                    }
                }
            }

            if (shipmentResults.length > 0) {
                return res.status(200).send(utils.responseSuccess(shipmentResults));
            }
        } catch (error) {
            console.error('External route match failed:', error?.response?.data || error.message);
            return res.status(404).send(utils.responseError(`No routes available for this shipment ${error?.response?.data || error.message}`))
        }
    }
    return res.status(404).send(utils.responseError(`No routes available for this shipment`))
}

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    matchTemplate
}
