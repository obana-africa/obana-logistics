const db = require('../models/db')
const utils = require('../../utils')
const { loadPricing, priceRates, recordSeenPartners } = require('../helpers/partnerPricing')
const { currencyForCountry, ngnRate } = require('../helpers/fx')
/* Zoho's naira-per-dollar rate, so the price the customer confirms, the summary
   they are sent and the message they receive all state the same dollars. */
const { quoteCurrency, nairaPer } = require('../helpers/currencyRates')
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

/**
 * The same failure, told to the person who can actually act on it.
 *
 * A lane we do not run is a gap in the route table: an admin can close it in a
 * minute, a customer cannot do anything about it at all. Sending both the same
 * sentence meant customers were reading "Add a route for this lane, or a
 * Nigeria-wide route with any_state set on both ends" — instructions for
 * somebody else's job, written in the words of our schema — when what they
 * needed was a person to talk to. Staff keep the instruction; everyone else
 * gets the plain fact and the contact. The log keeps the full detail either
 * way, because that is where it belongs.
 */
const isStaff = (req) =>
    req.user?.role === 'admin' || req.user?.email === (process.env.LOGISTICS_EMAIL || 'shipment@obana.africa');

/* The contact already published on the site and in the docs, so a customer
   told to get in touch reaches the same inbox either way. */
const SUPPORT = {
    email: process.env.SUPPORT_EMAIL || 'logistics@obana.africa',
    phone: process.env.SUPPORT_PHONE || '+234 809 033 5245'
};

const talkToUs = `call or WhatsApp ${SUPPORT.phone}, or email ${SUPPORT.email}`;

/** "Port Harcourt, Rivers" — how a person says where they are. */
const placeName = (a) => {
    const parts = [a?.city, a?.state].map((v) => String(v ?? '').trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : 'that address';
};

/**
 * What to say when no route covers the lane.
 * `pairs` is [{ origin, destination }, …] — one shipment can span several.
 */
const noRouteMessage = (req, pairs) => {
    if (isStaff(req)) {
        /* An arrow reads fine to someone who works with the route table. */
        const lanes = pairs.map(({ origin, destination }) => `${placeName(origin)} → ${placeName(destination)}`).join('; ');
        return `No route covers ${lanes} yet. Add one under Routes → New route — and tick "Serves the whole country" on an end that should cover everywhere.`;
    }
    /* A sentence, for someone who is simply trying to send something. */
    const lanes = pairs.map(({ origin, destination }) => `from ${placeName(origin)} to ${placeName(destination)}`).join(', and ');
    return `We don't deliver ${lanes} yet. Our team can still arrange it — ${talkToUs}.`;
};

/**
 * Every route template, held briefly in memory.
 *
 * Matching walks the whole table — a lane is decided by comparing metadata, not
 * by a column a query could filter on — so every rate request read every row,
 * each with its driver and that driver's user. That was tolerable while the
 * table was Lagos-only; full Nigerian coverage is roughly two thousand rows,
 * and checkout asks for rates on nearly every page.
 *
 * Thirty seconds is short enough that an admin editing a price sees it almost
 * at once, and long enough that a burst of checkouts reads the table once.
 */
const TEMPLATE_TTL_MS = 30 * 1000;
let templateCache = { at: 0, rows: null, loading: null };

const loadRouteTemplates = async () => {
    if (templateCache.rows && Date.now() - templateCache.at < TEMPLATE_TTL_MS) return templateCache.rows;
    // Share one query between requests that arrive together, rather than
    // letting each of them start its own on a cold cache.
    if (!templateCache.loading) {
        templateCache.loading = RouteTemplates.findAll({
            include: [{
                model: db.drivers,
                as: 'preferred_driver',
                include: [{ model: db.users, as: 'user', attributes: ['email'] }]
            }]
        })
            .then((rows) => {
                templateCache = { at: Date.now(), rows, loading: null };
                return rows;
            })
            .catch((error) => {
                templateCache.loading = null;
                throw error;
            });
    }
    return templateCache.loading;
};

/** Drop the cache when routes change, so an edit shows up without waiting. */
const invalidateRouteTemplates = () => {
    templateCache = { at: 0, rows: null, loading: null };
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
        invalidateRouteTemplates();

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
    invalidateRouteTemplates();

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
    invalidateRouteTemplates();

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

// How well one end of a template fits a place: 2 = same state; 1 = same country, when the lane is
// priced country to country (see laneTemplates), that end is outside Nigeria, or the template covers
// the whole country (metadata.<side>_any_state).
const endFit = (meta, side, state, countryCode, countryOnly = false) => {
    const tCountry = normalizeText(formatCountryCode(meta[`${side}_country_code`] || meta[`${side}_country`]))
    if (!meta[`${side}_country_code`] && !meta[`${side}_country`]) return 0
    if (tCountry !== countryCode) return 0
    if (normalizeState(meta[`${side}_state`]) === state) return 2
    return countryOnly || countryCode !== 'ng' || meta[`${side}_any_state`] ? 1 : 0
}

/**
 * Every template that serves this lane, best-fitting first. Templates flagged metadata.bidirectional
 * also serve the reverse direction (e.g. Lagos → Kano prices Kano → Lagos too).
 *
 * A lane that crosses a border is matched country to country, on both ends. One Italy → Nigeria
 * route therefore covers Milan and Villaverla alike, and Lagos and Port Harcourt alike: what decides
 * the cost of a cross-border job is the flight, and saying so should not take a row for every pair of
 * states — Italy to Nigeria alone would be twenty provinces times thirty-seven states. Before this,
 * an import priced from Italy reached Lagos and nowhere else, and the shipment that prompted it —
 * Villaverla to Port Harcourt — could not be quoted at all.
 *
 * A lane inside one country still matches on state, because Lagos → Kano and Lagos → Ogun are
 * genuinely different prices, and nothing about those two thousand rows changes.
 *
 * Fit is the two ends added together, so the more specific route still wins: with a route to Lagos
 * and a route to Rivers both on the books, a parcel to Port Harcourt takes the Rivers one.
 */
const laneTemplates = (routeTemplates, origin_state, origin_country, destination_state, destination_country) => {
    const oState = normalizeState(origin_state)
    const dState = normalizeState(destination_state)
    const oCountry = normalizeText(formatCountryCode(origin_country))
    const dCountry = normalizeText(formatCountryCode(destination_country))
    const countryOnly = oCountry !== dCountry
    const lane = []
    for (const t of routeTemplates) {
        const meta = t.metadata || {}
        /* Both ends have to fit, so a miss on either is a miss. */
        const fitBoth = (aState, aCountry, bState, bCountry) => {
            const a = endFit(meta, 'origin', aState, aCountry, countryOnly)
            if (!a) return 0
            const b = endFit(meta, 'destination', bState, bCountry, countryOnly)
            return b ? a + b : 0
        }
        const forward = fitBoth(oState, oCountry, dState, dCountry)
        const reverse = meta.bidirectional ? fitBoth(dState, dCountry, oState, oCountry) : 0
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
/**
 * A lane priced by the kilo, in the currency it was agreed in.
 *
 * A rate negotiated as "€10.09 a kilo" cannot be stored in naira without
 * drifting: the euro figure the customer was quoted would change every day
 * the exchange rate moved, and the forwarder's own invoice would stop
 * matching ours. So the lane holds the rate and its currency, and the naira
 * is worked out when a quote is asked for.
 *
 * Returns null unless a lane says it is priced this way, so every existing
 * lane keeps its weight brackets and prices exactly as before.
 */
/**
 * Prices typed in while booking, instead of the ones the lane holds.
 *
 * A lane can be priced by the kilo, but only by editing the route template —
 * and finding the right one for Lagos to Port Harcourt, or Italy to Nigeria,
 * takes longer than the booking does. So the three figures that actually move
 * between jobs can be given with the booking:
 *
 *   rate_per_kg      what a kilo costs on the crossing, in its own currency
 *   freight          or the crossing as one amount, when the job was quoted
 *                    as a job rather than by the kilo
 *   last_mile        the inland leg, as an amount rather than a rate
 *   handling_percent Obana's charge on top
 *
 * Anything left out keeps the lane's own figure, so a booking that overrides
 * nothing prices exactly as it does today. Every value is checked here, once,
 * because a number typed into a form reaches a customer's invoice: a negative
 * rate, a percentage of 900, or "11,0" meant as eleven would each be a quote
 * nobody agreed.
 */
const PRICING_LIMITS = {
    maxRatePerKg: Number(process.env.MAX_RATE_PER_KG || 1000000),
    maxLastMile: Number(process.env.MAX_LAST_MILE || 100000000),
    maxHandlingPercent: Number(process.env.MAX_HANDLING_PERCENT || 100),
}

const positiveAmount = (value, ceiling) => {
    if (value === undefined || value === null || value === '') return null
    const n = Number(String(value).replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0 || n > ceiling) return null
    return n
}

const readPricingOverrides = (body = {}) => {
    const raw = body.pricing && typeof body.pricing === 'object' ? body.pricing : {}

    const ratePerKg = positiveAmount(raw.rate_per_kg, PRICING_LIMITS.maxRatePerKg)
    /* Either way of saying it. A rate wins if both arrive, because it is the
       more specific of the two and the weight is known. */
    const freight = positiveAmount(raw.freight, PRICING_LIMITS.maxLastMile)
    /* A rate without a currency is ambiguous, and guessing naira for a figure
       meant in euros is wrong by three orders of magnitude. */
    const rateCurrency = String(raw.rate_currency || 'NGN').trim().toUpperCase()
    const currencyOk = /^[A-Z]{3}$/.test(rateCurrency)

    const handling = raw.handling_percent === undefined || raw.handling_percent === null || raw.handling_percent === ''
        ? null
        : Number(String(raw.handling_percent).replace(/,/g, ''))

    return {
        ratePerKg: ratePerKg && currencyOk ? ratePerKg : null,
        freight: ratePerKg && currencyOk ? null : freight,
        rateCurrency: ratePerKg && currencyOk ? rateCurrency : null,
        lastMile: positiveAmount(raw.last_mile, PRICING_LIMITS.maxLastMile),
        /* Zero is a real answer here — "charge nothing" — so it is kept, while
           a missing value still means "use the lane's". */
        handlingPercent:
            handling !== null && Number.isFinite(handling) && handling >= 0 && handling <= PRICING_LIMITS.maxHandlingPercent
                ? handling
                : null,
    }
}

/** True when anything was actually given. */
const hasPricingOverrides = (o) =>
    Boolean(o && (o.ratePerKg !== null || o.freight !== null || o.lastMile !== null || o.handlingPercent !== null))
const perKiloPrice = async (template, weight) => {
    const meta = template?.metadata ?? {}
    const rate = Number(meta.price_per_kg)
    if (!(rate > 0) || !(weight > 0)) return null

    const currency = String(meta.price_currency || 'NGN').toUpperCase()
    if (currency === 'NGN') return { base: rate * weight, currency, rate }

    const perUnit = await nairaPer(currency)
    /* No rate today means no price today, rather than a price in the wrong
       currency: quoting ₦10.09 where €10.09 was agreed is off by three
       orders of magnitude. The lane falls back to its weight brackets. */
    if (!(perUnit > 0)) {
        console.warn(`[routes] no ${currency} rate, so the per-kilo price for this lane cannot be converted`)
        return null
    }
    return { base: rate * weight * perUnit, currency, rate, nairaPerUnit: perUnit }
}

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
    let base = basePrice;
    if (isOverweight && maxWeight > 0) {
        base = basePrice + ((weight - maxWeight) * basePrice) / maxWeight;
        match.is_overweight = true;
    }

    /* Obana's service charge, as its own figure rather than folded into the
       price (partner rates have their own markup, applied where they are
       priced).

       It used to be multiplied into the number before anyone saw it, which made
       a quote impossible to check: a 131 kg job entered at ₦2,157,557 showed as
       ₦2,373,313 and nothing on the screen or in the books said where the
       difference came from. It is the same money either way — the customer was
       always paying it, and it is on Obana's own quotes as a line — so the fix
       is to show it, not to stop charging it.

       Kept separate all the way through: the quote, the booking form and the
       Books estimate each take the two numbers and put the charge where it
       belongs. The lines add up to the total exactly, because a quote whose
       parts do not sum is worse than one that rounds a naira oddly. */
    const kobo = (v) => Math.round(v * 100) / 100;
    const percent = routeMarkupPercent();
    match.base_price = Math.ceil(kobo(base));
    match.service_charge_percent = percent;
    match.service_charge = Math.ceil(kobo((match.base_price * percent) / 100));
    match.price = match.base_price + match.service_charge;

    /* Supersedes the cross-border exemption merged in #96. That removed the ten
       per cent from an international lane entirely, because it was being
       multiplied into a price that already included the forwarder's quote. The
       charge was never the problem — hiding it was. So it is charged again, on
       every lane, as a line of its own that the customer can see: a job entered
       at ₦2,157,557 quotes ₦2,157,557 plus ₦215,778, totalling what it always
       did. To take it off international again, this is the one line:
       percent = sameCountry ? routeMarkupPercent() : 0. */
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
/**
 * Where an international lane's freight lands before the last mile.
 *
 * On the template, because it differs by lane: goods out of Italy may clear
 * through Lagos while another corridor arrives somewhere else entirely. A
 * template that does not say has no last mile — which is what every template
 * says today, so nothing changes until somebody fills it in.
 */
const arrivalOf = (template, asked = null) => {
    /* What the person booking said, first. They are looking at the consignment
       and know where it lands; the template's own arrival city is a default
       for lanes that always land in the same place, not a rule that overrides
       somebody who has told us otherwise for this shipment. */
    const askedCity = String(asked?.city ?? '').trim()
    if (askedCity) return { city: askedCity, state: String(asked?.state ?? '').trim() }

    const meta = template?.metadata ?? {}
    const city = String(meta.arrival_city ?? '').trim()
    if (!city) return null
    return { city, state: String(meta.arrival_state ?? '').trim() }
}

/**
 * The home run from the arrival city to the door.
 *
 * Priced from the domestic templates, the same ones that price that journey
 * when somebody books it on its own — so the leg costs what it costs, rather
 * than a share of the international price invented to fill a line.
 *
 * The same service level where that lane runs it, because a customer who paid
 * for express across a border did not ask to wait a week at the end of it.
 * Cheapest otherwise, and nothing at all when the arrival city is already the
 * destination: there is no last mile to a door you have reached.
 */
/**
 * What the last mile costs, by the kilo, on its own terms.
 *
 * Door delivery after an international arrival is not the same job as the
 * domestic run somebody books on its own, and it is not priced like one —
 * so it does not borrow that lane's price. Taking it from the domestic route
 * would have meant that setting the last mile also repriced every direct
 * booking on the same lane, which is a four-fold rise on customers who are
 * not involved in this at all.
 *
 * Set per international lane, falling back to LAST_MILE_RATE_PER_KG for a
 * lane that does not say. Zero or unset means no own rate, and the domestic
 * lane is used as before.
 */
const lastMileRateFor = (template) => {
    const own = Number(template?.metadata?.last_mile_per_kg)
    if (own > 0) return own
    const fallback = Number(process.env.LAST_MILE_RATE_PER_KG)
    return fallback > 0 ? fallback : 0
}

const lastMileFor = async (routeTemplates, arrival, destinationState, destinationCountry, weight, serviceLevel, template = null) => {
    if (!arrival) return null

    /* Normalised before comparing, every time.
    
       This read `destinationCountry !== 'ng'` against a code built with
       .toUpperCase() a few lines away, so it compared 'NG' with 'ng' and was
       true on every shipment there has ever been. The last mile was therefore
       never priced — not once, whatever city or state anyone chose, and
       whatever routes existed. laneTemplates normalises its own arguments,
       which is why every other lookup worked and only this one did not. */
    if (normalizeText(formatCountryCode(destinationCountry)) !== 'ng') return null

    const arrivalState = normalizeState(arrival.state || arrival.city)
    /* The destination arrives as it was typed — "Rivers" — so it is
       normalised here too. Comparing 'lagos' against 'Lagos' would have
       missed the one case this guard exists for: an arrival state that is
       already the destination, where there is no last mile to charge. */
    if (!arrivalState || arrivalState === normalizeState(destinationState)) return null

    /* Its own rate, where the lane has one: door delivery after an arrival is
       not the domestic run somebody books on its own, and pricing it from that
       lane would mean setting this also reprices every direct booking on it. */
    const ownRate = lastMileRateFor(template)
    if (ownRate > 0) {
        return {
            from: arrival.city,
            base_price: Math.ceil(ownRate * weight),
            price: Math.ceil(ownRate * weight),
            service_level: serviceLevel,
            transport_mode: 'road',
            eta: null,
            per_kg: ownRate
        }
    }

    const options = await laneOptions(routeTemplates, arrivalState, 'ng', destinationState, 'ng', weight)
    if (!options.length) return null
    const sameService = options.find((o) => String(o.service_level).toLowerCase() === String(serviceLevel).toLowerCase())
    const chosen = sameService ?? options[0]
    return { ...chosen, from: arrival.city }
}

const laneOptions = async (routeTemplates, origin_state, origin_country, destination_state, destination_country, weight, places = null, overrides = null) => {
    const seen = new Set()
    const options = []
    for (const { template } of laneTemplates(routeTemplates, origin_state, origin_country, destination_state, destination_country)) {
        const service = bookableService(template)
        const key = `${service.transport_mode}|${service.service_level}`
        if (seen.has(key)) continue
        const match = priceTemplate(template, weight)
        if (!match || !(Number(match.price) > 0)) continue

        /* A lane priced by the kilo in its own currency overrides the bracket
           it would otherwise have used. The handling charge is then worked out
           on that figure, so the split still adds to the total. */
        /* A rate typed in while booking outranks both the lane's per-kilo rate
           and its weight brackets: it is the figure a person has just agreed
           with the customer. */
        const typedRate = overrides?.ratePerKg
            ? await perKiloPrice(
                  { metadata: { price_per_kg: overrides.ratePerKg, price_currency: overrides.rateCurrency } },
                  weight,
              )
            : null
        if (overrides?.handlingPercent !== null && overrides?.handlingPercent !== undefined) {
            match.service_charge_percent = overrides.handlingPercent
        }
        const byKilo = typedRate || await perKiloPrice(template, weight)
        /* Quoted as a job: the amount is the crossing, whatever it weighs. */
        if (!typedRate && overrides?.freight) {
            match.base_price = Math.ceil(Number(overrides.freight))
        }
        if (byKilo) {
            const kobo = (v) => Math.round(v * 100) / 100
            match.base_price = Math.ceil(kobo(byKilo.base))
            match.service_charge = Math.ceil(kobo((match.base_price * match.service_charge_percent) / 100))
            match.price = match.base_price + match.service_charge
            match.priced_per_kg = { rate: byKilo.rate, currency: byKilo.currency }
        }
        seen.add(key)

        /* The charge follows whichever base and percent ended up in play. */
        {
            const kobo = (v) => Math.round(v * 100) / 100
            const pct = Number(match.service_charge_percent ?? 0)
            match.service_charge = Math.ceil(kobo((Number(match.base_price ?? match.price) * pct) / 100))
            match.price = Math.ceil(Number(match.base_price ?? match.price)) + match.service_charge
        }

        let base = Math.ceil(Number(match.base_price ?? match.price))
        let legs = null

        /* A shipment that crosses a border and then travels on inside the
           country is two journeys, and the invoice says so. The carriage and
           the last mile are priced separately and added; the service charge is
           worked out once on the two together, because it is charged on the
           job and not on each leg of it.
        
           Only where the lane declares an arrival city. Until one does, an
           international option prices exactly as it does today. */
        const crossBorder =
            normalizeText(formatCountryCode(origin_country)) !== normalizeText(formatCountryCode(destination_country))
        const lastMile = crossBorder
            ? await lastMileFor(routeTemplates, arrivalOf(template, places?.arrival), destination_state, destination_country, weight, service.service_level, template)
            : null

        /* Asked for, and nothing to price it with. Said out loud rather than
           quietly dropped: a second leg that simply fails to appear looks
           exactly like a feature that does not work, and the cause — no
           domestic route between those two places — is something an admin can
           actually fix. */
        if (!lastMile && crossBorder && places?.arrival?.city) {
            options.unpricedLastMile = {
                from: places.arrival.city,
                to: places.destinationCity || destination_state,
            }
        }

        if (lastMile) {
            const carriage = base
            /* Typed in, or the lane's. An amount rather than a rate, because
               the inland leg is quoted as a job, not by the kilo. */
            const home = overrides?.lastMile
                ? Math.ceil(Number(overrides.lastMile))
                : Math.ceil(Number(lastMile.base_price ?? lastMile.price))
            base = carriage + home
            legs = [
                {
                    kind: 'international',
                    /* Country to country. Which Italian city the goods left
                       is not something the buyer chose or can act on; the
                       border crossing is what this line is about. */
                    from: places?.originCountry ?? '',
                    to: places?.destinationCountry ?? '',
                    base_price: carriage
                },
                {
                    kind: 'local',
                    /* City to city, and no country on either end: both are in
                       the same one, and naming it twice says nothing. */
                    from: lastMile.from || '',
                    to: places?.destinationCity ?? '',
                    base_price: home,
                    service_level: lastMile.service_level,
                    transport_mode: lastMile.transport_mode,
                    eta: lastMile.eta || null
                }
            ]
        }

        const percent = Number(match.service_charge_percent ?? 0)
        const charge = legs ? Math.ceil((base * percent) / 100) : Math.ceil(Number(match.service_charge ?? 0))

        options.push({
            id: `obana-${service.transport_mode}-${service.service_level.toLowerCase()}`,
            ...service,
            price: base + charge,
            /* The two halves of that price, for the screen and for the books. */
            base_price: base,
            service_charge: charge,
            service_charge_percent: percent,
            /* Present only on a shipment that really has two journeys. */
            ...(legs ? { legs } : {}),
            eta: match.eta || null,
            estimated_delivery: deliveryTimeRange(match.eta),
            preferred_driver: driverSummary(template.preferred_driver)
        })
    }
    const sorted = options.sort((a, b) => a.price - b.price)
    if (options.unpricedLastMile) sorted.unpricedLastMile = options.unpricedLastMile
    return sorted
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

/**
 * Hand the browser the rate rather than let it find its own.
 *
 * The confirm screen shows dollars beside naira on a cross-border booking, and
 * they have to be the dollars the summary and the WhatsApp message will carry.
 * A browser fetching a public feed would show a third figure, and the customer
 * would meet the disagreement on their invoice.
 *
 * Only when the two ends are really in different countries, and only when both
 * countries are actually filled in — formatCountryCode answers 'NG' for an
 * empty one, so a blank pickup country would otherwise read as domestic for a
 * Nigerian delivery and as cross-border for any other. Unknown means no
 * dollars, which is the harmless way to be wrong.
 *
 * Zero from Zoho means the screen shows naira alone.
 */
const crossBorderPair = (pickup, delivery) => {
    const from = String(pickup?.country ?? '').trim()
    const to = String(delivery?.country ?? '').trim()
    if (!from || !to) return false
    return formatCountryCode(from) !== formatCountryCode(to)
}

const withUsdRate = async (results, deliveryAddress, requestPickup) => {
    const pickupOf = (r) => r.pickup_address || r.items?.[0]?.pickup_address || requestPickup
    const crossing = results.find((r) => crossBorderPair(pickupOf(r), r.delivery_address || deliveryAddress))
    if (!crossing) return results

    /* The shipper's currency, which is what the confirm screen leads with:
       the sender is paying, and a naira figure is one they cannot price
       against anyone else without going to find a rate of their own. */
    const { code, nairaPerUnit } = await quoteCurrency(
        formatCountryCode(pickupOf(crossing)?.country),
        formatCountryCode((crossing.delivery_address || deliveryAddress)?.country)
    )
    if (!(nairaPerUnit > 0)) return results
    return results.map((r) => ({ ...r, base_currency: code, naira_per_base: nairaPerUnit }))
}

const matchTemplate = async (req, res) => {
    let { transport_mode, service_level, delivery_address, items, weight, pickup_address } = req.body
    /* Where the goods land before the last mile, as the booking states it.
       Blank means one journey, exactly as before. */
    /* Prices typed in while booking, if any. Checked once here so every lane
       priced below sees the same validated figures. */
    const pricingOverrides = readPricingOverrides(req.body)
    const arrival = req.body.arrival_city
        ? { city: String(req.body.arrival_city).trim(), state: String(req.body.arrival_state ?? '').trim() }
        : null
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

    const routeTemplates = await loadRouteTemplates()

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
                /* A flat handling fee is the whole of it. The split belonged to
                   the route price this replaced, and leaving it would show two
                   parts that do not add up to the two thousand being charged. */
                match.base_price = 2000;
                match.service_charge = 0;
                match.service_charge_percent = 0;
            }
            match.estimated_delivery = deliveryTimeRange(match.eta)
            const laneChoices = match.is_fulfilment_centre_handling_fee
                ? []
                : await laneOptions(routeTemplates, originState, originCountry, destinationState, destinationCountry, groupWeight, {
                    originCountry: group.pickup_address?.country || originCountry,
                    destinationCountry: delivery_address?.country || destinationCountry,
                    destinationCity: delivery_address?.city || delivery_address?.state || '',
                    arrival: arrival || null
                }, pricingOverrides)

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
                options: laneChoices,
                /* Why the second leg is missing, when one was asked for. */
                unpriced_last_mile: laneChoices.unpricedLastMile ?? null
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
        return res.status(200).send(utils.responseSuccess(await withUsdRate(shipmentResults, delivery_address, pickup_address)))
    }

    /* No Obana route for this lane, and partners are not being offered. The
       log names the lane, because the fix is a route template and nobody could
       act on "no routes available" — it reads as an outage when it is a gap.
       What the caller is told depends on who they are: see noRouteMessage. */
    if (!EXTERNAL_FALLBACK) {
        const lanes = externalGroups.map((g) => laneName(g.pickup_address, delivery_address))
        console.log(`[routes] no Obana route for ${lanes.join('; ')} — external fallback is off`)
        const pairs = externalGroups.map((g) => ({ origin: g.pickup_address, destination: delivery_address }))
        return res.status(404).send(utils.responseError(noRouteMessage(req, pairs), 'route_unavailable'))
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
            return res.status(200).send(utils.responseSuccess(await withUsdRate(shipmentResults, delivery_address, pickup_address)))
        }
        const lanes = externalGroups.map((g) => laneName(g.pickup_address, delivery_address))
        console.log(`[routes] no Obana route and no partner rate for ${lanes.join('; ')}`)
        const pairs = externalGroups.map((g) => ({ origin: g.pickup_address, destination: delivery_address }))
        return res.status(404).send(utils.responseError(noRouteMessage(req, pairs), 'route_unavailable'))
    } catch (error) {
        /* A carrier that refused us is not the same as a lane nobody runs, and
           reporting both as "no routes available" sent every investigation at
           the route table when the cause was a credential, and at the
           credential when the cause was the route table. */
        const detail = error?.response?.data?.message || error?.message || String(error)
        console.error('[routes] partner carrier lookup failed:', error?.response?.data || detail)
        return res.status(502).send(
            utils.responseError(
                isStaff(req)
                    ? `Could not reach the partner carrier for a rate: ${detail}`
                    : `We couldn't price this delivery just now — the carrier we check didn't answer. Please try again in a few minutes, or ${talkToUs}.`,
                'carrier_unreachable'
            )
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

/* `arrival` is where the goods land in the destination country, when the
   person booking has said. It turns the last stretch into its own priced leg. */
const buildQuoteOptions = async ({ origin, destination, originCode, destCode, weight, declared, arrival, overrides = null }) => {
    const options = []

    // 1. Obana fleet: one option per mode/service on this lane, from its best-fitting template (no Lagos fallback for quotes).
    const templates = await loadRouteTemplates()
    /* The names the two legs are labelled with: countries for the crossing,
       the delivery city for the home run. */
    const places = {
        originCountry: origin.country || originCode,
        destinationCountry: destination.country || destCode,
        destinationCity: destination.city || destination.state || '',
        arrival: arrival || null
    }
    for (const o of await laneOptions(templates, origin.state, originCode, destination.state, destCode, weight, places, overrides)) {
        options.push({
            id: o.id,
            provider: 'obana',
            carrier_name: 'Obana Logistics',
            logo_url: null,
            transport_mode: o.transport_mode,
            service_level: o.service_level,
            eta: o.eta,
            price: o.price,
            base_price: o.base_price ?? o.price,
            service_charge: o.service_charge ?? 0,
            service_charge_percent: o.service_charge_percent ?? 0
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
                        price: p.price,
                        /* A partner's markup is applied where the rate is
                           priced and is not a line of ours, so there is
                           nothing to break out here. */
                        base_price: p.price,
                        service_charge: 0,
                        service_charge_percent: 0
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
            // The log names the lane: "no routes available" reads as an outage,
            // and this is a gap in the route table. The caller here is a
            // visitor on the public site, so they get the plain version.
            console.log(`[routes] quote: no Obana route for ${laneName(origin, destination)}`)
            return res.status(404).send(utils.responseError(noRouteMessage(req, [{ origin, destination }]), 'route_unavailable'))
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
const quoteForAddresses = async ({ pickup, delivery, weight, declared = 0, arrival = null, overrides = null }) => {
    const originCode = String(formatCountryCode(pickup.country_code || pickup.country)).toUpperCase()
    const destCode = String(formatCountryCode(delivery.country_code || delivery.country)).toUpperCase()
    return buildQuoteOptions({
        origin: { city: String(pickup.city || ''), state: String(pickup.state || '') },
        destination: { city: String(delivery.city || ''), state: String(delivery.state || '') },
        originCode,
        destCode,
        weight,
        declared,
        arrival,
        overrides
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
    matchTemplate,
    /* The created-shipment message states the window it sold and the dates it
       lands on, and works both out from the same string this parses. */
    deliveryTimeRange
}
