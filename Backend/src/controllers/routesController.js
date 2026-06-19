const db = require('../models/db')
const utils = require('../../utils')
const axios = require('axios')
const { getCode } = require('country-list')
const lookup = require('country-code-lookup')
const { parsePhoneNumber } = require('libphonenumber-js');

require('dotenv').config()

const TERMINAL_AFRICA_BASE_URL = process.env.TERMINAL_AFRICA_BASE_URL;
const TERMINAL_AFRICA_SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY;

const taClient = axios.create({
    baseURL: TERMINAL_AFRICA_BASE_URL,
    headers: { 'Authorization': `Bearer ${TERMINAL_AFRICA_SECRET_KEY}`, 'Content-Type': 'application/json' }
});


const RouteTemplates = db.route_templates

const DEFAULT_ADDRESS = {
    phone: '+2348090335245',
    line1: '77 Opebi Road',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria'
}


/**
 * Validate city/state/line1 are non-empty strings
 */
const isValidAddressField = (field) => {
    return typeof field === 'string' && field.trim().length > 0
}


const formatPhoneNumberInternational = (phoneNumber, countryCode) => {
    try {
        // Remove any existing formatting
        const cleanedNumber = phoneNumber.replace(/[^\d]/g, '');

        // Validate country code
        const validCountryCode = countryCode.toUpperCase();

        // Try parsing the phone number
        const parsedPhoneNumber = parsePhoneNumber(cleanedNumber, validCountryCode);

        // Format to international standard
        if (parsedPhoneNumber && parsedPhoneNumber.isValid()) {
            return parsedPhoneNumber.formatInternational();
        }

        // Fallback to original number if parsing fails
        return phoneNumber;
    } catch (error) {
        console.warn('Phone number formatting error:', error);
        return phoneNumber;
    }
};

/**
 * Validate address object and return with fallbacks
 */
const validateAndFallbackAddress = (address = {}) => {
    const isCityValid = isValidAddressField(address.city)
    const isStateValid = isValidAddressField(address.state)
    const isLine1Valid = isValidAddressField(address.line1)
    const isCountryValid = isValidAddressField(address.country)
    // const isPhoneValid = isValidAddressField(address.phone) && String(address.phone || '').startsWith('+')
    const isPhoneValid = isValidAddressField(address.phone)

    const hasAnyMissing = !isPhoneValid || !isCityValid || !isStateValid || !isLine1Valid || !isCountryValid

    if (hasAnyMissing) {
        return { ...DEFAULT_ADDRESS }
    }
    address.country = formatCountryCode(address.country)
    address.phone = formatPhoneNumberInternational(address.phone, address.country)?.split(' ').join('')
    return address
}

/**
 * Convert a delivery_time string like "Within 7 days" into "MMM D - MMM D"
 * If input doesn't match pattern, return input unchanged.
 */
function deliveryTimeRange(delivery_time) {
    if (typeof delivery_time !== "string") return delivery_time;

    const withinMatch = delivery_time.match(/^\s*Within\s+(\d+)\s+days?\s*$/i);
    const rangeMatch = delivery_time.match(/^\s*(\d+)\s*-\s*(\d+)\s+days?\s*$/i);

    if (!withinMatch && !rangeMatch) return delivery_time;

    let startOffset = 0;
    let endOffset = 0;

    if (withinMatch) {
        endOffset = parseInt(withinMatch[1], 10);
        if (Number.isNaN(endOffset) || endOffset < 0) return delivery_time;
    } else {
        startOffset = parseInt(rangeMatch[1], 10);
        endOffset = parseInt(rangeMatch[2], 10);
        if (
            Number.isNaN(startOffset) || Number.isNaN(endOffset) ||
            startOffset < 0 || endOffset < 0 ||
            endOffset < startOffset
        ) {
            return delivery_time;
        }
    }

    const now = new Date();
    const start = new Date(now.getTime());
    start.setDate(start.getDate() + startOffset);

    const end = new Date(now.getTime());
    end.setDate(end.getDate() + endOffset);

    const opts = { month: "long", day: "numeric" };
    const startStr = start.toLocaleDateString("en-US", opts);
    const endStr = end.toLocaleDateString("en-US", opts);

    return `${startStr} - ${endStr}`;
}

const listTemplates = async (req, res) => {
    const templates = await RouteTemplates.findAll({
        order: [['id', 'DESC']],
        include: [{
            model: db.drivers,
            as: 'preferred_driver',
            include: [{ model: db.users, as: 'user', attributes: ['email'] }]
        }] 
    })
    return res.status(200).send(utils.responseSuccess(templates))
}

const getTemplate = async (req, res) => {
    const id = req.params.id
    const template = await RouteTemplates.findByPk(id, {
        include: [{
            model: db.drivers,
            as: 'preferred_driver',
            include: [{ model: db.users, as: 'user', attributes: ['email'] }]
        }]
    })
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

const normalizeText = (value) => {
    if (typeof value !== 'string') return ''
    return value.trim().toLowerCase()
}

const formatCountryCode = (country) => {
    if (!country) return 'NG'
    const normalized = String(country).trim()
    if (normalized.length === 2) return normalized.toUpperCase()
    const alpha2 = getCode(normalized) || lookup.byCountry(normalized.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()))?.iso2
    return alpha2 ? alpha2.toUpperCase() : country
}

const getGroupingKey = (pickupAddress = {}) => JSON.stringify({
    state: normalizeText(pickupAddress.state),
    country: normalizeText(pickupAddress.country)
})

const buildTemplateMatch = (routeTemplates, origin_state, origin_country, destination_state, destination_country, transport_mode, service_level, weight) => {
    if (!origin_state || !origin_country || !destination_state || !destination_country || !transport_mode || !service_level || typeof weight === 'undefined') return null

    const nOriginState = normalizeText(origin_state);
    const nOriginCountry = normalizeText(origin_country);
    const nDestState = normalizeText(destination_state);
    const nDestCountry = normalizeText(destination_country);
    const nMode = normalizeText(transport_mode);
    const nLevel = normalizeText(service_level);

    // 1. Find the first matching template based on country, state, and service parameters
    const template = routeTemplates.find(t =>
        normalizeText(t.metadata?.origin_state) === nOriginState &&
        normalizeText(t.metadata?.origin_country) === nOriginCountry &&
        normalizeText(t.metadata?.destination_state) === nDestState &&
        normalizeText(t.metadata?.destination_country) === nDestCountry &&
        normalizeText(t.transport_mode) === nMode &&
        normalizeText(t.service_level) === nLevel
    );

    if (!template) return null;

    const brackets = template.weight_brackets || [];
    if (brackets.length === 0) return null;

    // 2. Try to find an exact weight bracket match
    for (const bracket of brackets) {
        const min = Number(bracket.min || 0);
        const max = Number(bracket.max || Number.POSITIVE_INFINITY);
        if (weight >= min && weight <= max) {
            return { template, match: { ...bracket } };
        }
    }

    // 3. If weight exceeds all brackets, use proportional pricing based on the highest bracket
    const highestBracket = brackets.reduce((prev, curr) =>
        (Number(curr.max || 0) > Number(prev.max || 0)) ? curr : prev
        , brackets[0]);

    const maxWeight = Number(highestBracket?.max || 0);
    if (highestBracket && weight > maxWeight && maxWeight > 0) {
        const basePrice = Number(highestBracket.price || 0);
        const additionalWeight = weight - maxWeight;
        const additionalPrice = (additionalWeight * basePrice) / maxWeight;

        const adjustedBracket = { ...highestBracket };
        adjustedBracket.price = basePrice + additionalPrice;
        adjustedBracket.is_overweight = true;
        return { template, match: adjustedBracket };
    }

    return null;
};

const normalizeItem = (item) => ({
    ...item,
    quantity: parseInt(item.quantity, 10) || 1,
    weight: parseFloat(item.weight) || 0,
    value: Number(item.value || item.price || 0) || 0,
    currency: item.currency || 'NGN'
})

const buildTerminalPayload = (pickupAddress, deliveryAddress, items) => {
    const validatedPickup = validateAndFallbackAddress(pickupAddress)
    const validatedDelivery = validateAndFallbackAddress(deliveryAddress)

    // console.log("validatedPickup substitute", validatedPickup)
    // console.log("validatedDelivery substitute", validatedDelivery)


    return {
        pickup_address: {
            first_name: validatedPickup.contact_name?.split(' ')[0] || 'obana',
            last_name: validatedPickup.contact_name?.split(' ')[1] || 'africa',
            email: validatedPickup.email || 'obana.africa@gmail.com',
            phone: validatedPickup.phone,
            line1: validatedPickup.line1,
            city: validatedPickup.city,
            state: validatedPickup.state,
            country: validatedPickup.country,
            zip: validatedPickup.zip || validatedPickup.zip_code || '100001'
        },
        delivery_address: {
            first_name: validatedDelivery.first_name || 'obana',
            last_name: validatedDelivery.last_name || 'africa',
            email: validatedDelivery.email || 'obana.africa@gmail.com',
            phone: validatedDelivery.phone,
            line1: validatedDelivery.line1,
            line2: validatedDelivery.line2 || '77 opebi road',
            city: validatedDelivery.city,
            state: validatedDelivery.state,
            country: validatedDelivery.country,
            zip: validatedDelivery.zip || validatedDelivery.zip_code || '100001'
        },
        parcel: {
            description: 'obana logistics goods',
            items: items.map(item => ({
                name: item.name,
                description: item.description || item.name,
                currency: item.currency || 'NGN',
                value: item.value || 0,
                weight: item.weight || 0.5,
                quantity: item.quantity || 1,
                item_id: item.item_id,
                price: item.price ?? 0
            })),
            weight_unit: 'kg',
            metadata: {}
        },
        shipment_purpose: 'commercial'
    }
}

const matchTemplate = async (req, res) => {
    let { transport_mode, service_level, delivery_address, items, weight, pickup_address } = req.body
    const parcel = req.body.parcel
    let shipmentResults = []

    // Handle different payload formats
    if (parcel) {

        // Format 2: parcel with items that have pickup_address
        items = parcel.items || items
        delivery_address = delivery_address || req.body.delivery_address
    } else {
        // Format 1: direct parameters
        items = items || []
        delivery_address = delivery_address || req.body.delivery_address
        pickup_address = pickup_address || req.body.pickup_address
        transport_mode = transport_mode || req.body.transport_mode
        service_level = service_level || req.body.service_level
        weight = weight || req.body.weight
    }

    if (!items || !Array.isArray(items) || items.length === 0 || !delivery_address) {
        return res.status(400).send(utils.responseError('Missing required parameters'))
    }

    transport_mode = transport_mode || 'road'
    service_level = service_level || 'Standard'

    const normalizedItems = items.map(normalizeItem)
    let groupedItems = {}

    if (parcel) {
        // Group by pickup_address for parcel format
        groupedItems = normalizedItems.reduce((acc, item) => {
            const key = getGroupingKey(item.pickup_address || {}).toLowerCase()
            if (!acc[key]) acc[key] = { pickup_address: item.pickup_address || {}, items: [] }
            acc[key].items.push(item)
            return acc
        }, {})
    } else {
        // Single shipment format
        const key = getGroupingKey(pickup_address || {})
        groupedItems[key] = { pickup_address: pickup_address || {}, items: normalizedItems }
    }

    const routeTemplates = await RouteTemplates.findAll({
        include: [{
            model: db.drivers,
            as: 'preferred_driver',
            include: [{ model: db.users, as: 'user', attributes: ['email'] }]
        }]
    })

    const externalGroups = []
    for (const group of Object.values(groupedItems)) {
        let originState, originCountry, destinationState, destinationCountry, groupWeight

        originState = group.pickup_address?.state
        originCountry = group.pickup_address?.country
        destinationState = delivery_address.state
        destinationCountry = delivery_address.country
        groupWeight = weight || group.items.reduce((sum, item) => sum + (item.weight * (item.quantity || 1)), 0)

        const nOriginCountry = normalizeText(formatCountryCode(originCountry));
        const nDestCountry = normalizeText(formatCountryCode(destinationCountry));
        const isDomesticNigeria = nOriginCountry === 'ng' && nDestCountry === 'ng';

        const templateMatch = buildTemplateMatch(
            routeTemplates,
            originState,
            originCountry,
            destinationState,
            destinationCountry,
            transport_mode,
            service_level,
            groupWeight
        )

        let selectedTemplateMatch = templateMatch;

        // If no exact template match, try the default Lagos-Lagos fallback for this individual group
        const isDeliveryToFulfilmentCentre = delivery_address?.last_name === 'Fulfilment Centre';
        if (!selectedTemplateMatch) {
            const individualFallbackTemplateMatch = buildTemplateMatch(
                routeTemplates,
                'Lagos', 
            'Nigeria',
                'Lagos',
            'Nigeria',
            'Road',
            'standard',
            groupWeight
            );
            if (individualFallbackTemplateMatch) {
                selectedTemplateMatch = individualFallbackTemplateMatch;
            }
        }

        if (selectedTemplateMatch) {
            // Apply N2000 flat rate if it's a domestic Nigerian shipment AND delivery is to Fulfilment Centre
            if (isDomesticNigeria && isDeliveryToFulfilmentCentre) {
                selectedTemplateMatch.match.price = 2000;
                selectedTemplateMatch.match.is_fulfilment_centre_handling_fee = true;
            }
            if (templateMatch) {
                // Exact match
                selectedTemplateMatch.match.estimated_delivery = deliveryTimeRange(selectedTemplateMatch.match.eta)
                shipmentResults.push({
                    external: false,
                    pickup_address: group.pickup_address,
                    delivery_address,
                    items: group.items,
                    template: selectedTemplateMatch.template,
                    match: selectedTemplateMatch.match,
                    preferred_driver: selectedTemplateMatch.template.preferred_driver ? {
                        id: selectedTemplateMatch.template.preferred_driver.id,
                        driver_code: selectedTemplateMatch.template.preferred_driver.driver_code,
                        vehicle_type: selectedTemplateMatch.template.preferred_driver.vehicle_type,
                        email: selectedTemplateMatch.template.preferred_driver.user?.email
                    } : null
                })
            } else {
                // This is an individual fallback match (Lagos-Lagos default)
                selectedTemplateMatch.match.estimated_delivery = deliveryTimeRange(selectedTemplateMatch.match.eta)
                shipmentResults.push({
                    external: false,
                    pickup_address: group.pickup_address,
                    delivery_address,
                    items: group.items,
                    template: selectedTemplateMatch.template,
                    match: selectedTemplateMatch.match,
                    preferred_driver: selectedTemplateMatch.template.preferred_driver ? {
                        id: selectedTemplateMatch.template.preferred_driver.id,
                        driver_code: selectedTemplateMatch.template.preferred_driver.driver_code,
                        vehicle_type: selectedTemplateMatch.template.preferred_driver.vehicle_type,
                        email: selectedTemplateMatch.template.preferred_driver.user?.email
                    } : null
                })
            }
        } else {
            // If no internal match (exact or fallback), then it's an external or unmatchable route
            externalGroups.push({
                pickup_address: group.pickup_address,
                items: group.items,
                weight: groupWeight
            })
        }
    }
    if (externalGroups.length === 0 && shipmentResults.length > 0) {
        return res.status(200).send(utils.responseSuccess(shipmentResults))
    }

    try {
        for (const group of externalGroups) {
            const payload = buildTerminalPayload(group.pickup_address, delivery_address, group.items)
            console.log('Terminal Africa payload:', JSON.stringify(payload, null, 2))
            const quickResponse = await taClient.post('/shipments/quick', payload)

            if (!quickResponse.data || !quickResponse.data.status || !quickResponse.data.data?.shipment_id) {
                continue
            }

            const shipmentId = quickResponse.data.data.shipment_id
            const ratesResponse = await taClient.get(`/rates/shipment?shipment_id=${shipmentId}&currency=NGN`)
            const rates = ratesResponse.data?.data || []

            if (!rates.length) {
                continue
            }

            const bestRate = rates[0]
            shipmentResults.push({
                external: true,
                shipment_id: shipmentId,
                rate_id: bestRate.rate_id,
                carrier: { name: bestRate.carrier_name, logo: bestRate.carrier_logo },
                items: group.items,
                match: {
                    price: bestRate.amount + (10 / 100),
                    eta: deliveryTimeRange(bestRate.delivery_time),
                    min: 0,
                    max: group.weight,
                    estimated_delivery: deliveryTimeRange(bestRate.delivery_time)
                }
            })
        }

        if (shipmentResults.length > 0) {
            return res.status(200).send(utils.responseSuccess(shipmentResults))
        }
        console.log("reachhhh")
        return res.status(404).send(utils.responseError('No routes available for this shipment'))
    } catch (error) {
        console.error('External route match failed:', error?.response?.data || error.message)
        return res.status(404).send(utils.responseError(`No routes available for this shipment ${JSON.stringify(error?.response?.data || error.message)}`))
    }
}

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    matchTemplate
}
