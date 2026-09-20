const db = require('../models/db')
const utils = require('../../utils')
const { loadPricing, priceRates, recordSeenPartners } = require('../helpers/partnerPricing')
const { currencyForCountry, ngnRate } = require('../helpers/fx')
const axios = require('axios')
const crypto = require('crypto')
const { getCode } = require('country-list')
const lookup = require('country-code-lookup')
const { parsePhoneNumber } = require('libphonenumber-js');
const util = require('../utility/utils.js');
const querystring = require('node:querystring');


require('dotenv').config()

const TERMINAL_AFRICA_BASE_URL = process.env.TERMINAL_AFRICA_BASE_URL;
const TERMINAL_AFRICA_SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY;

const taClient = axios.create({
    baseURL: TERMINAL_AFRICA_BASE_URL,
    headers: { 'Authorization': `Bearer ${TERMINAL_AFRICA_SECRET_KEY}`, 'Content-Type': 'application/json' }
});

/**
 * Whether a lane with no Obana route may be quoted by an outside carrier.
 *
 * The marketplace is meant to see one carrier — Obana. A partner's price
 * reaching a customer as a partner's price is a decision for when the partner
 * side is built properly, with its own branding, margin and settlement; until
 * then this stays off, and a lane we do not run says so plainly.
 *
 * Off also removes a whole class of confusion. An expired partner key and a
 * lane nobody has priced were arriving as the same sentence, so the first
 * guess was always the credential and the real answer was always the route
 * table.
 */
const EXTERNAL_FALLBACK = String(process.env.ROUTES_EXTERNAL_FALLBACK ?? 'false').trim().toLowerCase() === 'true';

/** Names the lane in a message, so a gap in the route table is actionable. */
const laneName = (origin, destination) => {
    const part = (a) => [a?.state, a?.city].map((v) => String(v ?? '').trim()).filter(Boolean).join(' / ') || 'unknown';
    return `${part(origin)} → ${part(destination)}`;
};


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






const sanitizeSku = (str) =>
    str.normalize('NFKD')
       .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
       .replace(/[^a-zA-Z0-9\s-]/g, '')   // strip special chars (→, parentheses, etc.)
       .trim()
       .replace(/\s+/g, '-')
       .toUpperCase();

const getZohoUsdExchangeRate = () => {
    const envRate = process.env.ZOHO_USD_EXCHANGE_RATE || process.env.NAIRA_TO_USD_RATE || process.env.EXCHANGE_RATE || process.env.ZOHO_EXCHANGE_RATE;
    const parsed = parseFloat(envRate);
    return parsed > 0 ? parsed : 1460;
};

const deriveRouteItemUnitPrice = (weight_brackets = []) => {
    if (!Array.isArray(weight_brackets) || weight_brackets.length === 0) return 0;
    const first = weight_brackets[0] || {};
    const explicit = Number(first.unit_price || 0);
    if (explicit > 0) return explicit;

    const price = Number(first.price || 0);
    const min = Number(first.min || 0);
    const max = Number(first.max || 0);
    const width = max > min ? max - min : max > 0 ? max : 1;
    return width > 0 ? price / width : price;
};

const buildZohoRouteItemData = (routeTemplate, driverEmail) => {
    const {
        origin_city,
        destination_city,
        transport_mode,
        service_level,
        weight_brackets,
        metadata,
        preferred_driver_id
    } = routeTemplate;

    // Route service items are prefixed "Ob-Log-" so downstream systems (e.g. Tajiri's
    // manual-salesorder flow) can reliably distinguish a route item from a product item.
    const routeLabel = `${origin_city} → ${destination_city} (${transport_mode})`;
    const itemName = `Ob-Log-${routeLabel}`;
    const skuString = `Ob-Log-${sanitizeSku(routeLabel)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const safe = (val) => (val === null || val === undefined ? '' : String(val));

    const routeUnitPriceNgn = deriveRouteItemUnitPrice(weight_brackets);
    const zohoExchangeRate = getZohoUsdExchangeRate();
    const routeUnitPriceUsd = routeUnitPriceNgn && zohoExchangeRate > 0
        ? Number((routeUnitPriceNgn / zohoExchangeRate).toFixed(2))
        : 0;

    const payload = {
        name: itemName,
        item_type: 'sales_and_purchases',
        product_type: 'service',
        sku: skuString,
        rate: routeUnitPriceUsd,
        custom_fields: [
            { label: 'origin', value: `${safe(origin_city)}, ${safe(metadata?.origin_state)}, ${safe(metadata?.origin_country)}` },
            { label: 'destination', value: `${safe(destination_city)}, ${safe(metadata?.destination_state)}, ${safe(metadata?.destination_country)}` },
            { label: 'Shipping Mode', value: safe(transport_mode) },
            { label: 'service_level', value: safe(service_level) },
            { label: 'weight_brackets', value: JSON.stringify(weight_brackets) },
            { label: 'Preferred Driver', value: driverEmail || safe(preferred_driver_id) }
        ]
    };

    return { itemName, skuString, payload };
};

const getRouteTemplateDriverEmail = async (routeTemplate) => {
    if (!routeTemplate?.preferred_driver_id) return null;

    const driver = await db.drivers.findOne({
        where: { id: routeTemplate.preferred_driver_id },
        include: [{
            model: db.users,
            as: 'user',
            attributes: ['id', 'email', 'phone', 'createdAt']
        }]
    });

    return driver?.user?.email || null;
};

const findZohoInventoryItemId = async (accessToken, itemName, skuString) => {
    const response = await axios.get(
        `${process.env.ZOHO_BASE_URL}items?organization_id=${process.env.ZOHO_ORG_ID}`,
        { headers: { Authorization: accessToken, 'Content-Type': 'application/json' } }
    );

    const items = response.data?.items || response.data?.data || [];
    const match = items.find((item) => item?.name === itemName || item?.sku === skuString);
    return match?.item_id || null;
};

const createZohoInventoryItem = async (accessToken, routeTemplate, driverEmail) => {
    const { itemName, skuString, payload } = buildZohoRouteItemData(routeTemplate, driverEmail);

    const response = await axios.post(
        `${process.env.ZOHO_BASE_URL}items?organization_id=${process.env.ZOHO_ORG_ID}`,
        payload,
        { headers: { Authorization: accessToken, 'Content-Type': 'application/json' } }
    );

    return { ...response.data, itemName, skuString };
};

const updateZohoInventoryItem = async (accessToken, routeTemplate, driverEmail) => {
    const { itemName, skuString, payload } = buildZohoRouteItemData(routeTemplate, driverEmail);
    let itemId = routeTemplate?.zoho_item_id || null;

    if (!itemId) {
        itemId = await findZohoInventoryItemId(accessToken, itemName, skuString);
    }

    if (!itemId) {
        const createdItem = await createZohoInventoryItem(accessToken, routeTemplate, driverEmail);
        if (routeTemplate?.id) {
            await RouteTemplates.update(
                { zoho_item_id: createdItem?.item_id || null },
                { where: { id: routeTemplate.id } }
            );
        }
        return createdItem;
    }

    const response = await axios.put(
        `${process.env.ZOHO_BASE_URL}items/${itemId}?organization_id=${process.env.ZOHO_ORG_ID}`,
        payload,
        { headers: { Authorization: accessToken, 'Content-Type': 'application/json' } }
    );

    if (routeTemplate?.id) {
        await RouteTemplates.update(
            { zoho_item_id: response.data?.item_id || itemId },
            { where: { id: routeTemplate.id } }
        );
    }

    return { ...response.data, item_id: itemId, itemName, skuString };
};

const deleteZohoInventoryItem = async (accessToken, routeTemplate) => {
    const { itemName, skuString } = buildZohoRouteItemData(routeTemplate, null);
    let itemId = routeTemplate?.zoho_item_id || null;

    if (!itemId) {
        itemId = await findZohoInventoryItemId(accessToken, itemName, skuString);
    }

    if (!itemId) return null;

    await axios.delete(
        `${process.env.ZOHO_BASE_URL}items/${itemId}?organization_id=${process.env.ZOHO_ORG_ID}`,
        { headers: { Authorization: accessToken, 'Content-Type': 'application/json' } }
    );

    return { item_id: itemId };
};

const createTemplate = async (req, res) => {
    const body = req.body;
    try {
        // 1. Create route template in DB
        const t = await RouteTemplates.create(body);

        // 2. Find driver email
        const driverEmail = await getRouteTemplateDriverEmail(t);

        // 3. Get Zoho access token
        const accessToken = await util.getZohoInventoryToken();

        // 4. Create Zoho inventory item
        const createdItem = await createZohoInventoryItem(accessToken, t, driverEmail);
        await t.update({ zoho_item_id: createdItem?.item_id || null });

        return res.status(201).send(utils.responseSuccess(t));
    } catch (err) {
        // Still return success if Zoho fails but log it
        console.error('Zoho inventory sync error:', err?.response?.data || err.message);
        return res.status(422).send(utils.responseError(err.message));
    }
};

const updateTemplate = async (req, res) => {
    const id = req.params.id
    const body = req.body
    const t = await RouteTemplates.findByPk(id)
    if (!t) return res.status(404).send(utils.responseError('Not found'))

    // The admin form sends only location metadata; keep the rest (bidirectional, seed marker, provider).
    if (body && body.metadata && typeof body.metadata === 'object') body.metadata = { ...(t.metadata || {}), ...body.metadata }
    const updatedTemplate = await t.update(body)

    try {
        const accessToken = await util.getZohoInventoryToken();
        const driverEmail = await getRouteTemplateDriverEmail(updatedTemplate);
        await updateZohoInventoryItem(accessToken, updatedTemplate, driverEmail);
    } catch (err) {
        console.error('Zoho inventory sync error:', err?.response?.data || err.message);
    }

    return res.status(200).send(utils.responseSuccess(updatedTemplate))
}

const deleteTemplate = async (req, res) => {
    const id = req.params.id
    const t = await RouteTemplates.findByPk(id)
    if (!t) return res.status(404).send(utils.responseError('Not found'))

    await t.destroy()

    try {
        const accessToken = await util.getZohoInventoryToken();
        await deleteZohoInventoryItem(accessToken, t);
    } catch (err) {
        console.error('Zoho inventory sync error:', err?.response?.data || err.message);
    }

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

// State names arrive in several spellings ("Lagos State", "FCT", "Abuja Federal Capital Territory", "Akwa-Ibom").
const STATE_ALIASES = {
    'fct': 'federal capital territory',
    'abuja': 'federal capital territory',
    'abuja fct': 'federal capital territory',
    'abuja federal capital territory': 'federal capital territory',
    'nassarawa': 'nasarawa'
}

const normalizeState = (value) => {
    const s = normalizeText(value).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').replace(/ state$/, '').trim()
    return STATE_ALIASES[s] || s
}

// How well one end of a template fits a place: 2 = same state; 1 = same country, when that end is outside
// Nigeria (we price abroad per country) or the template covers the whole country (metadata.<side>_any_state).
const endFit = (meta, side, state, countryCode) => {
    const tCountry = normalizeText(formatCountryCode(meta[`${side}_country_code`] || meta[`${side}_country`]))
    if (!meta[`${side}_country_code`] && !meta[`${side}_country`]) return 0
    if (tCountry !== countryCode) return 0
    if (normalizeState(meta[`${side}_state`]) === state) return 2
    return countryCode !== 'ng' || meta[`${side}_any_state`] ? 1 : 0
}

/**
 * Every template that serves this lane, best-fitting first. Templates flagged metadata.bidirectional
 * also serve the reverse direction (e.g. Lagos → Kano prices Kano → Lagos too).
 */
const laneTemplates = (routeTemplates, origin_state, origin_country, destination_state, destination_country) => {
    const oState = normalizeState(origin_state)
    const dState = normalizeState(destination_state)
    const oCountry = normalizeText(formatCountryCode(origin_country))
    const dCountry = normalizeText(formatCountryCode(destination_country))
    const lane = []
    for (const t of routeTemplates) {
        const meta = t.metadata || {}
        const forward = Math.min(endFit(meta, 'origin', oState, oCountry), endFit(meta, 'destination', dState, dCountry))
        const reverse = meta.bidirectional ? Math.min(endFit(meta, 'origin', dState, dCountry), endFit(meta, 'destination', oState, oCountry)) : 0
        const fit = Math.max(forward, reverse)
        if (fit > 0) lane.push({ template: t, fit })
    }
    return lane.sort((a, b) => b.fit - a.fit)
}

/**
 * Price a template for a weight. Brackets are keyed on their MAX weight:
 *   totalWeight <= max  ->  price = the route price set on the bracket
 *   totalWeight >  max  ->  price = route price + (totalWeight - max) * route price / max
 * With multiple brackets, use the lowest-max bracket that still covers the weight;
 * if the weight exceeds every bracket, use the highest-max bracket (overweight case).
 */
const priceTemplate = (template, weight) => {
    const brackets = template.weight_brackets || [];
    if (brackets.length === 0) return null;

    const sortedByMax = [...brackets].sort((a, b) => Number(a.max || 0) - Number(b.max || 0));
    let bracket = sortedByMax.find((b) => weight <= Number(b.max || Number.POSITIVE_INFINITY));
    const isOverweight = !bracket;
    if (!bracket) bracket = sortedByMax[sortedByMax.length - 1];

    const maxWeight = Number(bracket.max || 0);
    const basePrice = Number(bracket.price || 0);

    const match = { ...bracket };
    if (isOverweight && maxWeight > 0) {
        match.price = basePrice + ((weight - maxWeight) * basePrice) / maxWeight;
        match.is_overweight = true;
    } else {
        match.price = basePrice;
    }
    // Obana's margin on its own routes, applied once to the total (partner rates have their own markup).
    // Round to kobo first so float noise (11000 × 1.1 = 12100.000000000002) doesn't add a naira.
    match.price = Math.ceil(Math.round(match.price * (1 + routeMarkupPercent() / 100) * 100) / 100);
    return match;
};

/** ROUTE_MARKUP_PERCENT on the server (default 10). Set it to 0 to charge route prices as entered. */
const routeMarkupPercent = () => {
    const raw = process.env.ROUTE_MARKUP_PERCENT;
    const n = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 10;
};

/**
 * The best template for a lane and its price. The requested mode/service are preferences, not filters:
 * when the lane has no exact match we fall back to the closest service on it (same mode first), and
 * say so via `exact: false` so the customer sees what they're actually booking.
 */
const buildTemplateMatch = (routeTemplates, origin_state, origin_country, destination_state, destination_country, transport_mode, service_level, weight) => {
    if (!origin_state || !origin_country || !destination_state || !destination_country || typeof weight === 'undefined') return null

    const nMode = normalizeText(transport_mode);
    const nLevel = normalizeText(service_level);
    const score = (t) => (normalizeText(t.transport_mode) === nMode ? 2 : 0) + (normalizeText(t.service_level) === nLevel ? 1 : 0)

    const candidates = laneTemplates(routeTemplates, origin_state, origin_country, destination_state, destination_country)
        .filter(({ template }) => (template.weight_brackets || []).length > 0)
        .sort((a, b) => b.fit - a.fit || score(b.template) - score(a.template))
    if (!candidates.length) return null;

    const template = candidates[0].template;
    const match = priceTemplate(template, weight);
    if (!match) return null;
    return { template, match, exact: score(template) === 3 };
};

// A template's mode/service as the shipments API accepts them (legacy "International Express" books as Express).
const bookableService = (template) => {
    const mode = normalizeText(template.transport_mode)
    const level = normalizeText(template.service_level)
    return {
        transport_mode: ['road', 'air', 'sea'].includes(mode) ? mode : 'road',
        service_level: ['Express', 'Standard', 'Economy'].find((l) => normalizeText(l) === level) || (level.includes('express') ? 'Express' : 'Standard')
    }
}

const driverSummary = (driver) => driver
    ? { id: driver.id, driver_code: driver.driver_code, vehicle_type: driver.vehicle_type, email: driver.user?.email }
    : null

/** Every service on a lane priced for this weight: one per mode/service (best-fitting route wins), cheapest first. */
const laneOptions = (routeTemplates, origin_state, origin_country, destination_state, destination_country, weight) => {
    const seen = new Set()
    const options = []
    for (const { template } of laneTemplates(routeTemplates, origin_state, origin_country, destination_state, destination_country)) {
        const service = bookableService(template)
        const key = `${service.transport_mode}|${service.service_level}`
        if (seen.has(key)) continue
        const match = priceTemplate(template, weight)
        if (!match || !(Number(match.price) > 0)) continue
        seen.add(key)
        options.push({
            id: `obana-${service.transport_mode}-${service.service_level.toLowerCase()}`,
            ...service,
            price: Math.ceil(Number(match.price)),
            eta: match.eta || null,
            estimated_delivery: deliveryTimeRange(match.eta),
            preferred_driver: driverSummary(template.preferred_driver)
        })
    }
    return options.sort((a, b) => a.price - b.price)
}

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

        // Only deliveries to the Fulfilment Centre fall back to the Lagos → Lagos route; any other lane without
        // a route goes to partner carriers (the old fallback charged intra-Lagos prices for e.g. Kano).
        const isDeliveryToFulfilmentCentre = delivery_address?.last_name === 'Fulfilment Centre';
        const selectedTemplateMatch = templateMatch || (isDeliveryToFulfilmentCentre
            ? buildTemplateMatch(routeTemplates, 'Lagos', 'Nigeria', 'Lagos', 'Nigeria', 'road', 'Standard', groupWeight)
            : null);

        if (selectedTemplateMatch) {
            const { template, match, exact } = selectedTemplateMatch
            match.price = Math.ceil(Number(match.price))
            // Apply N2000 flat rate if it's a domestic Nigerian shipment AND delivery is to Fulfilment Centre
            if (isDomesticNigeria && isDeliveryToFulfilmentCentre) {
                match.price = 2000;
                match.is_fulfilment_centre_handling_fee = true;
            }
            match.estimated_delivery = deliveryTimeRange(match.eta)
            shipmentResults.push({
                external: false,
                pickup_address: group.pickup_address,
                delivery_address,
                items: group.items,
                template,
                match,
                // What will actually be booked: differs from the request when this lane doesn't run that service.
                service: { ...bookableService(template), substituted: !exact },
                preferred_driver: driverSummary(template.preferred_driver),
                // Every service on this lane, cheapest first, for the customer to pick from
                // (the Fulfilment Centre flat fee has just the one price).
                options: match.is_fulfilment_centre_handling_fee
                    ? []
                    : laneOptions(routeTemplates, originState, originCountry, destinationState, destinationCountry, groupWeight)
            })
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

    /* No Obana route for this lane, and partners are not being offered. Say
       which lane, because the fix is a route template and nobody could act on
       "no routes available" — it reads as an outage when it is a gap. */
    if (!EXTERNAL_FALLBACK) {
        const lanes = externalGroups.map((g) => laneName(g.pickup_address, delivery_address))
        console.log(`[routes] no Obana route for ${lanes.join('; ')} — external fallback is off`)
        return res.status(404).send(
            utils.responseError(
                `No Obana route for ${lanes.join('; ')}. Add a route for this lane, ` +
                    'or a Nigeria-wide route with any_state set on both ends.'
            )
        )
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

            // Partner pricing: skip partners switched off in admin, add markup, offer the cheapest.
            const pricing = await loadPricing(db)
            recordSeenPartners(db, rates, pricing.partners) // fire-and-forget
            const priced = priceRates(rates, pricing.partners, pricing.defaultPercent)
            if (!priced.length) {
                continue
            }
            const best = priced[0]
            const bestRate = best.rate
            shipmentResults.push({
                external: true,
                shipment_id: shipmentId,
                rate_id: bestRate.rate_id,
                carrier: { name: bestRate.carrier_name, logo: bestRate.carrier_logo, partner: best.slug },
                items: group.items,
                match: {
                    price: best.price,
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
        const lanes = externalGroups.map((g) => laneName(g.pickup_address, delivery_address))
        console.log(`[routes] no Obana route and no partner rate for ${lanes.join('; ')}`)
        return res.status(404).send(utils.responseError(`No route available for ${lanes.join('; ')}`))
    } catch (error) {
        /* A carrier that refused us is not the same as a lane nobody runs, and
           reporting both as "no routes available" sent every investigation at
           the route table when the cause was a credential, and at the
           credential when the cause was the route table. */
        const detail = error?.response?.data?.message || error?.message || String(error)
        console.error('[routes] partner carrier lookup failed:', error?.response?.data || detail)
        return res.status(502).send(
            utils.responseError(`Could not reach the partner carrier for a rate: ${detail}`)
        )
    }
}

// webhookController.js


const createTemplateFromZoho = async (req, res) => {
    try {
        const item = req.body?.item || req.body;

        // Loop guard: ignore items your app created via API
        if (item.source === 'api') {
            return res.status(200).send(utils.responseSuccess({ skipped: true, reason: 'source=api' }));
        }

        // Map by LABEL, not api_name — Zoho's api_name is frozen at field creation
        // and does not update when you rename the field's display label.
        const fieldsByLabel = {};
        (item.custom_fields || []).forEach(f => {
            fieldsByLabel[f.label] = f.value;
        });

        const parseLocation = (str = '') => {
            const parts = (str || '').split(',').map(s => s?.trim() || '');
            return { city: parts[0] || '', state: parts[1] || '', country: parts[2] || '' };
        };

        const origin = parseLocation(fieldsByLabel['origin']);
        const destination = parseLocation(fieldsByLabel['destination']);

        let weight_brackets = [];
        const rawBrackets = fieldsByLabel['weight_brackets'];
        if (rawBrackets) {
            try {
                weight_brackets = JSON.parse(rawBrackets);
            } catch (e) {
                console.error('weight_brackets parse failed:', rawBrackets);
                weight_brackets = [];
            }
        }

        // Driver lookup by email (value of "Preferred Driver" field)
        let preferred_driver_id = null;
        const driverFieldValue = fieldsByLabel['Preferred Driver'];
        if (driverFieldValue) {
            const isEmail = driverFieldValue.includes('@');
            const driver = isEmail
                ? await db.drivers.findOne({
                    include: [{
                        model: db.users,
                        as: 'user',
                        where: { email: driverFieldValue },
                        attributes: ['id', 'email']
                    }]
                  })
                : await db.drivers.findOne({ where: { id: driverFieldValue } });
            preferred_driver_id = driver?.id || null;
        }

        const body = {
            origin_city: origin.city,
            destination_city: destination.city,
            transport_mode: fieldsByLabel['Shipping Mode'],
            service_level: fieldsByLabel['service_level'],
            weight_brackets,
            metadata: {
                origin_state: origin.state,
                origin_country: origin.country,
                destination_state: destination.state,
                destination_country: destination.country
            },
            preferred_driver_id,
            source: 'zoho',
            zoho_item_id: item.item_id
        };

        const t = await RouteTemplates.create(body);
        return res.status(201).send(utils.responseSuccess(t));
    } catch (err) {
        console.error('Zoho webhook sync error:', err);
        return res.status(422).send(utils.responseError(err.message));
    }
};


// Admin: live partner options for an Obana-fleet shipment we want to hand to a partner carrier.
const partnerQuotesForShipment = async (req, res) => {
    try {
        const shipment = await db.shippings.findByPk(req.params.shipment_id, {
            include: [
                { model: db.addresses, as: 'pickup_address' },
                { model: db.addresses, as: 'delivery_address' },
                { model: db.shipment_items, as: 'items' }
            ]
        })
        if (!shipment) return res.status(404).send(utils.responseError('Shipment not found'))
        if (shipment.carrier_type === 'external' || shipment.external_carrier_reference) {
            return res.status(400).send(utils.responseError('This shipment is already with a partner carrier'))
        }
        if (['delivered', 'failed', 'cancelled', 'returned'].includes(shipment.status)) {
            return res.status(400).send(utils.responseError(`Shipment is ${shipment.status}`))
        }

        const pickup = shipment.pickup_address ? shipment.pickup_address.get({ plain: true }) : {}
        const delivery = shipment.delivery_address ? shipment.delivery_address.get({ plain: true }) : {}
        const items = (shipment.items || []).map((item) => {
            const i = item.get({ plain: true })
            const value = Number(i.total_price ?? i.price ?? 0) || 0
            return { name: i.name, description: i.description, quantity: Number(i.quantity) || 1, weight: Number(i.weight) || 0.5, price: value, value, currency: i.currency || shipment.currency || 'NGN' }
        })
        const payload = buildTerminalPayload(pickup, delivery, items.length ? items : [{ name: 'Parcel', quantity: 1, weight: Number(shipment.total_weight) || 0.5 }])

        const quick = await taClient.post('/shipments/quick', payload)
        const terminalShipmentId = quick.data && quick.data.data && quick.data.data.shipment_id
        if (!terminalShipmentId) return res.status(502).send(utils.responseError('Partner rates are unavailable right now'))

        const ratesResponse = await taClient.get(`/rates/shipment?shipment_id=${terminalShipmentId}&currency=NGN`)
        const rates = (ratesResponse.data && ratesResponse.data.data) || []
        const pricing = await loadPricing(db)
        recordSeenPartners(db, rates, pricing.partners) // fire-and-forget
        const priced = priceRates(rates, pricing.partners, pricing.defaultPercent)

        return res.status(200).send(utils.responseSuccess({
            terminal_shipment_id: terminalShipmentId,
            // Obana is the buyer here (the customer has already paid), so cheapest partner cost first.
            options: priced
                .sort((a, b) => a.cost - b.cost)
                .slice(0, 8)
                .map((p) => ({
                    rate_id: p.rate.rate_id,
                    carrier_name: p.rate.carrier_name,
                    carrier_logo: p.rate.carrier_logo || null,
                    partner: p.slug,
                    cost: p.cost,
                    price: p.price,
                    markup_percent: p.markup_percent,
                    eta: deliveryTimeRange(p.rate.delivery_time) || null
                }))
        }))
    } catch (error) {
        console.error('Partner quotes failed:', error?.response?.data || error.message)
        return res.status(502).send(utils.responseError('Could not get partner rates. Check the addresses and try again.'))
    }
}

// ---------- Public quotes (no login) ----------
const QUOTE_TTL_MS = 30 * 60 * 1000
const quoteCache = new Map()

const etaDays = (eta) => {
    const m = String(eta || '').match(/(\d+)/)
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

// A guest only tells us the area. Keep the real city/state/country so the partner prices the right
// lane; street and phone are placeholders (a quote needs no doorstep). Built directly instead of via
// validateAndFallbackAddress, which would swap an incomplete address for the Ikeja office.
const quoteAddress = (place, countryCode) => ({
    first_name: 'Obana',
    last_name: 'Quote',
    email: 'obana.africa@gmail.com',
    phone: DEFAULT_ADDRESS.phone,
    line1: `${place.city.trim()} city centre`,
    city: place.city.trim(),
    state: place.state.trim(),
    country: countryCode,
    zip: '100001'
})

const buildQuoteOptions = async ({ origin, destination, originCode, destCode, weight, declared }) => {
    const options = []

    // 1. Obana fleet: one option per mode/service on this lane, from its best-fitting template (no Lagos fallback for quotes).
    const templates = await RouteTemplates.findAll()
    for (const o of laneOptions(templates, origin.state, originCode, destination.state, destCode, weight)) {
        options.push({
            id: o.id,
            provider: 'obana',
            carrier_name: 'Obana Logistics',
            logo_url: null,
            transport_mode: o.transport_mode,
            service_level: o.service_level,
            eta: o.eta,
            price: o.price
        })
    }

    // 2. Partner carriers for international lanes, or when our fleet doesn't
    //    cover the route — only while partners are being offered at all.
    if (EXTERNAL_FALLBACK && (originCode !== 'NG' || destCode !== 'NG' || !options.length)) {
        try {
            const payload = {
                pickup_address: quoteAddress(origin, originCode),
                delivery_address: quoteAddress(destination, destCode),
                parcel: {
                    description: 'Quote',
                    items: [{ name: 'Parcel', description: 'Parcel', currency: 'NGN', value: declared, weight, quantity: 1 }],
                    weight_unit: 'kg',
                    metadata: {}
                },
                shipment_purpose: 'commercial'
            }
            const quick = await taClient.post('/shipments/quick', payload)
            const shipmentId = quick.data && quick.data.data && quick.data.data.shipment_id
            if (shipmentId) {
                const ratesResponse = await taClient.get(`/rates/shipment?shipment_id=${shipmentId}&currency=NGN`)
                const rates = (ratesResponse.data && ratesResponse.data.data) || []
                const pricing = await loadPricing(db)
                recordSeenPartners(db, rates, pricing.partners) // fire-and-forget
                priceRates(rates, pricing.partners, pricing.defaultPercent).slice(0, 6).forEach((p, i) => {
                    options.push({
                        id: `partner-${p.slug}-${i}`,
                        provider: 'partner',
                        carrier_name: p.rate.carrier_name,
                        logo_url: p.rate.carrier_logo || null,
                        transport_mode: null,
                        service_level: null,
                        eta: p.rate.delivery_time || null,
                        price: p.price
                    })
                })
            }
        } catch (error) {
            console.error('Partner quote failed:', error?.response?.data || error.message)
        }
    }

    return options.sort((a, b) => a.price - b.price)
}

/**
 * POST /routes/quote — public price check (no login, rate limited, cached 30 min).
 * Prices are in NGN (what Obana charges today) plus a conversion to the customer's currency.
 */
const publicQuote = async (req, res) => {
    const body = req.body || {}
    const origin = body.origin || {}
    const destination = body.destination || {}
    const hasPlace = (p) => typeof p.city === 'string' && p.city.trim() && typeof p.state === 'string' && p.state.trim() && (p.country_code || p.country)
    if (!hasPlace(origin) || !hasPlace(destination)) {
        return res.status(400).send(utils.responseError('Choose the country, state and city for both pickup and delivery'))
    }
    const weight = Number(body.weight_kg)
    if (!Number.isFinite(weight) || weight < 0.1 || weight > 1000) {
        return res.status(400).send(utils.responseError('Weight must be between 0.1 and 1000 kg'))
    }
    const declared = Math.max(0, Number(body.declared_value) || 0)
    const originCode = String(formatCountryCode(origin.country_code || origin.country)).toUpperCase()
    const destCode = String(formatCountryCode(destination.country_code || destination.country)).toUpperCase()
    const wanted = /^[A-Za-z]{3}$/.test(String(body.display_currency || '')) ? String(body.display_currency).toUpperCase() : currencyForCountry(originCode)

    const key = JSON.stringify([originCode, normalizeText(origin.state), normalizeText(origin.city), destCode, normalizeText(destination.state), normalizeText(destination.city), Math.round(weight * 100) / 100, declared])
    try {
        let cached = quoteCache.get(key)
        if (!cached || Date.now() - cached.at > QUOTE_TTL_MS) {
            cached = { at: Date.now(), options: await buildQuoteOptions({ origin, destination, originCode, destCode, weight, declared }) }
            quoteCache.set(key, cached)
            if (quoteCache.size > 500) quoteCache.delete(quoteCache.keys().next().value)
        }
        if (!cached.options.length) {
            // Name the lane. "No routes available" reads as an outage; this is
            // a gap in the route table, and saying so is what makes it fixable.
            console.log(`[routes] quote: no Obana route for ${laneName(origin, destination)}`)
            return res.status(404).send(utils.responseError(`No Obana route for ${laneName(origin, destination)}`))
        }

        const fx = await ngnRate(wanted)
        const options = cached.options.map((o) => ({ ...o, display_price: fx ? Math.round(o.price * fx.rate * 100) / 100 : null }))
        const cheapest = options.reduce((a, b) => (b.price < a.price ? b : a))
        const fastest = options.reduce((a, b) => (etaDays(b.eta) < etaDays(a.eta) ? b : a))
        const saved = await saveQuote({ origin, destination, originCode, destCode, weight, options, displayCurrency: fx ? wanted : 'NGN' })
        return res.status(200).send(utils.responseSuccess({
            // Carried to booking so nothing is re-entered after sign-up; null if saving failed.
            reference: saved ? saved.reference : null,
            currency: 'NGN',
            display_currency: fx ? wanted : 'NGN',
            fx: fx ? { rate: fx.rate, as_of: fx.as_of, source: fx.source } : null,
            options,
            cheapest_id: cheapest.id,
            fastest_id: Number.isFinite(etaDays(fastest.eta)) ? fastest.id : null,
            // A saved quote holds its prices for 24 hours; an unsaved one only as long as the price cache.
            expires_at: (saved ? new Date(saved.expires_at) : new Date(cached.at + QUOTE_TTL_MS)).toISOString()
        }))
    } catch (error) {
        console.error('Public quote failed:', error?.response?.data || error.message)
        return res.status(502).send(utils.responseError('We could not get prices right now. Please try again in a moment.'))
    }
}

// ---------- Saved quotes (quote → sign up → book, without losing anything) ----------
const QUOTE_HOLD_MS = 24 * 60 * 60 * 1000

const newQuoteReference = () => `Q-${crypto.randomBytes(5).toString('hex').toUpperCase()}`

const quotePlace = (p, countryCode) => ({
    city: String(p.city || '').trim(),
    state: String(p.state || '').trim(),
    state_code: String(p.state_code || ''),
    country: String(p.country || countryCode),
    country_code: countryCode
})

/** Save a public quote. Never throws: the visitor still gets prices if saving fails. */
const saveQuote = async ({ origin, destination, originCode, destCode, weight, options, displayCurrency }) => {
    try {
        return await db.quotes.create({
            reference: newQuoteReference(),
            origin: quotePlace(origin, originCode),
            destination: quotePlace(destination, destCode),
            weight_kg: weight,
            currency: 'NGN',
            display_currency: displayCurrency,
            options,
            expires_at: new Date(Date.now() + QUOTE_HOLD_MS)
        })
    } catch (error) {
        console.error('Could not save quote:', error.message)
        return null
    }
}

/** GET /routes/quote/:reference — a saved quote for the booking page (signed in). */
const getQuote = async (req, res) => {
    try {
        const quote = await db.quotes.findOne({ where: { reference: String(req.params.reference || '').toUpperCase() } })
        if (!quote) return res.status(404).send(utils.responseError('Quote not found'))
        return res.status(200).send(utils.responseSuccess({
            reference: quote.reference,
            origin: quote.origin,
            destination: quote.destination,
            weight_kg: Number(quote.weight_kg),
            currency: quote.currency,
            display_currency: quote.display_currency,
            options: quote.options,
            status: quote.status,
            expires_at: quote.expires_at,
            expired: new Date(quote.expires_at) <= new Date()
        }))
    } catch (error) {
        console.error('Get quote failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load this quote'))
    }
}

/**
 * The quote option a booking may take at the quoted price, or null. Holds only while the quote is unexpired
 * and unbooked, for an Obana-fleet option (partner rates are re-checked at booking), on the same route
 * (states and countries) and at no more than the quoted weight.
 */
const heldQuoteOption = (quote, { optionId, pickup, delivery, weight }) => {
    if (!quote || quote.status !== 'quoted' || new Date(quote.expires_at) <= new Date()) return null
    const option = (quote.options || []).find((o) => o.id === optionId && o.provider === 'obana')
    if (!option || !pickup || !delivery) return null
    const samePlace = (place, saved) =>
        normalizeState(place.state) === normalizeState(saved.state) &&
        String(formatCountryCode(place.countryCode || place.country_code || place.country)).toUpperCase() === String(saved.country_code).toUpperCase()
    if (!samePlace(pickup, quote.origin) || !samePlace(delivery, quote.destination)) return null
    if (!(weight > 0) || weight > Number(quote.weight_kg) + 0.01) return null
    return option
}

/** Server-side price options for a pickup/delivery pair — used to price store shipments. */
const quoteForAddresses = async ({ pickup, delivery, weight, declared = 0 }) => {
    const originCode = String(formatCountryCode(pickup.country_code || pickup.country)).toUpperCase()
    const destCode = String(formatCountryCode(delivery.country_code || delivery.country)).toUpperCase()
    return buildQuoteOptions({
        origin: { city: String(pickup.city || ''), state: String(pickup.state || '') },
        destination: { city: String(delivery.city || ''), state: String(delivery.state || '') },
        originCode,
        destCode,
        weight,
        declared
    })
}

module.exports = {
    buildTemplateMatch,
    laneTemplates,
    laneOptions,
    quoteForAddresses,
    publicQuote,
    getQuote,
    heldQuoteOption,
    partnerQuotesForShipment,
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createTemplateFromZoho,
    matchTemplate
}
