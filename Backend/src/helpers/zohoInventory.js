const axios = require('axios')

// Zoho Inventory, for the Zoho → Obana shipment flow.
//
// Zoho's own Create Shipment button can only reach carriers Zoho itself
// integrates; Obana will never be on that list. So ops flags the sales order
// instead, Zoho's workflow rule calls us, and everything below is how we read
// what we need out of Zoho and write the result back.
//
// Nothing here trusts a figure Zoho did not give us. In particular the naira →
// dollar rate is fetched from Zoho's own currency settings for the day of the
// shipment: the books must agree with themselves, and a rate kept anywhere else
// drifts from them silently.

const AUTH_URL = process.env.ZOHO_AUTH_URL || 'https://accounts.zoho.com/oauth/v2/token'
const BASE_URL = (process.env.ZOHO_BASE_URL || 'https://www.zohoapis.com/inventory/v1/').replace(/\/?$/, '/')
const BOOKS_URL = (process.env.ZOHO_BOOKS_BASE_URL || 'https://www.zohoapis.com/books/v3/').replace(/\/?$/, '/')
const TIMEOUT_MS = Number(process.env.ZOHO_TIMEOUT_MS) || 20000

// Zoho access tokens last an hour. Refreshing on every call — which the older
// code does — burns the OAuth rate limit and adds a round trip to each request.
const TOKEN_TTL_MS = 50 * 60 * 1000

/** Weight assumed for an item with no cf_weight, per unit. */
const DEFAULT_ITEM_WEIGHT_KG = Number(process.env.ZOHO_DEFAULT_ITEM_WEIGHT_KG) || 0.5

let tokenCache = null // { value, fetchedAt }
let tokenInflight = null

const orgId = () => String(process.env.ZOHO_ORG_ID || '').trim()

const num = (value) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

const accessToken = async ({ force = false } = {}) => {
    if (!force && tokenCache && Date.now() - tokenCache.fetchedAt < TOKEN_TTL_MS) return tokenCache.value

    if (!tokenInflight) {
        tokenInflight = axios
            .post(AUTH_URL, null, {
                params: {
                    refresh_token: process.env.INVENTORY_REFRESH_TOKEN,
                    client_id: process.env.ZOHO_CLIENT_ID,
                    client_secret: process.env.ZOHO_CLIENT_SECRET,
                    grant_type: 'refresh_token'
                },
                timeout: TIMEOUT_MS
            })
            .then(({ data }) => {
                if (!data?.access_token) throw new Error(`Zoho refused the refresh token: ${data?.error || 'no access_token'}`)
                tokenCache = { value: `Zoho-oauthtoken ${data.access_token}`, fetchedAt: Date.now() }
                return tokenCache.value
            })
            .finally(() => { tokenInflight = null })
    }
    return tokenInflight
}

/**
 * One Zoho call. Retries once on 401 with a fresh token, because a token can
 * expire between being cached and being used.
 */
const call = async (method, path, { params = {}, data = null, books = false } = {}) => {
    const root = books ? BOOKS_URL : BASE_URL
    const send = async (token) =>
        axios({
            method,
            url: `${root}${path}`,
            params: { organization_id: orgId(), ...params },
            data,
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            timeout: TIMEOUT_MS,
            validateStatus: () => true
        })

    let response = await send(await accessToken())
    if (response.status === 401) response = await send(await accessToken({ force: true }))

    const body = typeof response.data === 'string' ? safeJson(response.data) : response.data

    // Zoho answers 200 with a non-zero code for business refusals, so status
    // alone never tells you whether a call worked.
    if (response.status >= 400 || (body && body.code !== undefined && body.code !== 0)) {
        const message = body?.message || `HTTP ${response.status}`
        const error = new Error(`Zoho ${method.toUpperCase()} ${path} failed: ${message}`)
        error.zoho = { status: response.status, code: body?.code ?? null, message: body?.message ?? null }
        throw error
    }
    return body
}

const safeJson = (text) => {
    try { return JSON.parse(text) } catch { return null }
}

/* ────────────────────────────────── reads ────────────────────────────────── */

/** The sales order: customer, shipping address, contact persons, line items. */
const getSalesOrder = async (salesOrderId) => {
    const body = await call('get', `salesorders/${encodeURIComponent(salesOrderId)}`)
    const order = body?.salesorder
    if (!order) throw new Error(`Sales order ${salesOrderId} not found in Zoho`)
    return order
}

/** The customer record behind an order — where the phone usually actually is. */
const getContact = async (contactId) => {
    const body = await call('get', `contacts/${encodeURIComponent(contactId)}`)
    return body?.contact ?? null
}

/** Find a sales order by its human number (SO-00042) rather than its id. */
const findSalesOrderByNumber = async (salesOrderNumber) => {
    const body = await call('get', 'salesorders', { params: { salesorder_number: salesOrderNumber } })
    const list = Array.isArray(body?.salesorders) ? body.salesorders : []
    const hit = list.find((o) => String(o.salesorder_number) === String(salesOrderNumber)) || list[0]
    return hit?.salesorder_id ? String(hit.salesorder_id) : null
}

/** Zoho stores a weight next to its unit, and the unit is not always kg. */
const TO_KG = { kg: 1, kgs: 1, g: 0.001, gm: 0.001, gms: 0.001, lb: 0.45359237, lbs: 0.45359237, oz: 0.0283495231 }

const toKg = (value, unit) => {
    const n = Number.parseFloat(value)
    if (!Number.isFinite(n) || n <= 0) return null
    const factor = TO_KG[String(unit || 'kg').trim().toLowerCase()]
    return factor ? n * factor : null
}

/**
 * Weight in kilograms for each item.
 *
 * Zoho keeps this in package_details — its Package Geometry — not in a custom
 * field, and that is where the real numbers are: the org has cf_weight defined
 * but set on none of its items, while package_details carries 0.8 kg for a boot
 * and 0.5 kg for a shirt. Reading cf_weight alone therefore found nothing and
 * defaulted every line, which is a quoted price built on a guess while Zoho
 * held the answer.
 *
 * cf_weight is still read last, so an org that does populate it keeps working.
 *
 * Fetched for the whole order in one call rather than one per line. Whatever
 * still has no weight falls back to DEFAULT_ITEM_WEIGHT_KG and is reported in
 * `defaulted` — a silent default is how an under-quoted shipment becomes a
 * standing loss nobody can trace, so the caller records which lines guessed.
 */
const getItemWeights = async (itemIds) => {
    const ids = [...new Set((itemIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
    const weights = new Map()
    const defaulted = []
    // Zoho refuses to package a service, and only the item master knows which
    // is which — a sales-order line reports "goods" for an item recorded as a
    // service, so the line cannot be trusted for this.
    const productTypes = new Map()
    if (!ids.length) return { weights, defaulted, productTypes }

    const body = await call('get', 'itemdetails', { params: { item_ids: ids.join(',') } })
    const items = Array.isArray(body?.items) ? body.items : []

    for (const item of items) {
        const id = String(item.item_id)
        productTypes.set(id, String(item.product_type || 'goods').toLowerCase())

        const cf =
            item.custom_field_hash?.cf_weight ??
            (Array.isArray(item.custom_fields)
                ? item.custom_fields.find((f) => f.api_name === 'cf_weight')?.value
                : undefined)

        const found =
            toKg(item.package_details?.weight, item.package_details?.weight_unit) ??
            toKg(item.weight, item.weight_unit) ??
            toKg(cf, 'kg')

        if (found) {
            weights.set(id, Number(found.toFixed(4)))
        } else {
            weights.set(id, DEFAULT_ITEM_WEIGHT_KG)
            defaulted.push({ item_id: id, name: item.name ?? null })
        }
    }

    // An item Zoho did not return at all still has to weigh something.
    for (const id of ids) {
        if (!weights.has(id)) {
            weights.set(id, DEFAULT_ITEM_WEIGHT_KG)
            defaulted.push({ item_id: id, name: null, reason: 'not_returned_by_zoho' })
        }
    }

    return { weights, defaulted, productTypes }
}

/**
 * How many naira to one unit of the organisation's base currency, as Zoho
 * itself holds it for that date.
 *
 * Deliberately not an env constant and not a public FX feed. The shipping
 * charge we write lands in the same books as the order it belongs to; if we
 * convert at a different rate than Zoho uses, the order silently stops adding
 * up. When Zoho has no rate for the day we say so and refuse, rather than
 * guessing at money.
 */
const getNairaRate = async (onDate) => {
    const body = await call('get', 'settings/currencies', { books: true })
    const currencies = Array.isArray(body?.currencies) ? body.currencies : []

    const ngn = currencies.find((c) => String(c.currency_code).toUpperCase() === 'NGN')
    if (!ngn) throw new Error('NGN is not set up as a currency in Zoho, so a shipping charge cannot be converted')

    const rates = await call('get', `settings/currencies/${ngn.currency_id}/exchangerates`, { books: true })
    const list = Array.isArray(rates?.exchange_rates) ? rates.exchange_rates : []
    if (!list.length) throw new Error('Zoho holds no NGN exchange rate — add one in Currencies before shipping')

    // The rate in force on the day: the most recent one not after it.
    const day = String(onDate || new Date().toISOString().slice(0, 10))
    const inForce = list
        .filter((r) => String(r.effective_date || '') <= day)
        .sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0]

    const chosen = inForce || list.sort((a, b) => String(a.effective_date).localeCompare(String(b.effective_date)))[0]

    /* Zoho names this field `rate` on the exchangerates endpoint, not
       `exchange_rate`. Reading the wrong one produced undefined, then zero, then
       a thrown error every single time — so this function has never once
       returned a rate, and every caller has been quietly living on its fallback. */
    const quoted = num(chosen?.rate ?? chosen?.exchange_rate)
    if (quoted <= 0) throw new Error('Zoho returned an NGN exchange rate of zero')

    /* And it is quoted the other way round from how this codebase uses it:
       0.000588 is dollars per naira, while every caller divides a naira figure
       by `rate` expecting naira per dollar. Returning Zoho's number unchanged
       would turn a ₦26,400 delivery into a $44,897,959 one — arithmetic that
       is discovered in the accounts, not in a test. Normalised here, once, so
       no caller has to know which way Zoho happens to quote it.

       Judged by magnitude rather than by trusting a label: a naira-per-dollar
       rate is in the hundreds or thousands, a dollar-per-naira rate is a tiny
       fraction, and nothing plausible sits near 1. */
    const rate = quoted < 1 ? 1 / quoted : quoted

    return {
        rate,
        quoted,
        inverted: quoted < 1,
        effective_date: chosen.effective_date ?? null,
        used_fallback: !inForce
    }
}

/* ────────────────────────────────── writes ───────────────────────────────── */

/**
 * The box: which sales-order lines, and how many of each.
 *
 * Zoho requires a package number — it does not generate one for you — and the
 * org already numbers every package OBN-PA-<hex>, so keep to that. Random
 * rather than derived from the shipment, because a retry after a half-failed
 * write-back must not collide with a package the first attempt created.
 */
const createPackage = async ({ salesOrderId, lineItems, date, packageNumber }) => {
    const body = await call('post', 'packages', {
        params: { salesorder_id: salesOrderId },
        data: {
            date: date || new Date().toISOString().slice(0, 10),
            package_number: packageNumber || `OBN-PA-${require('crypto').randomBytes(4).toString('hex')}`,
            line_items: lineItems.map((li) => ({
                so_line_item_id: String(li.so_line_item_id),
                quantity: num(li.quantity)
            }))
        }
    })
    const pkg = body?.package
    if (!pkg?.package_id) throw new Error('Zoho created no package')
    return pkg
}

/**
 * The shipment against that box.
 *
 * delivery_method and tracking_number are free text, which is the whole reason
 * this works without Obana being one of Zoho's built-in carriers.
 */
const createShipmentOrder = async ({
    salesOrderId,
    packageIds,
    shipmentNumber,
    trackingNumber,
    deliveryMethod = 'Obana Logistics',
    shippingCharge,
    date,
    notes,
    customFields
}) => {
    const body = await call('post', 'shipmentorders', {
        params: { salesorder_id: salesOrderId, package_ids: packageIds.join(',') },
        data: {
            shipment_number: shipmentNumber,
            date: date || new Date().toISOString().slice(0, 10),
            delivery_method: deliveryMethod,
            tracking_number: trackingNumber,
            ...(shippingCharge === undefined ? {} : { shipping_charge: num(shippingCharge) }),
            ...(notes ? { notes } : {}),
            ...(customFields?.length ? { shipmentorder_custom_fields: customFields } : {})
        }
    })
    const shipment = body?.shipment_order ?? body?.shipmentorder
    // Zoho answers with shipment_order.shipment_id here, not the
    // shipmentorder_id its own documentation names. Reading only the documented
    // field would throw on a shipment order it had just created successfully,
    // and the write-back would look like a failure while Zoho held the record.
    const id = shipment?.shipment_id ?? shipment?.shipmentorder_id
    if (!id) throw new Error(`Zoho created no shipment order — got ${JSON.stringify(body).slice(0, 200)}`)
    return { ...shipment, shipmentorder_id: String(id) }
}

/** Move a shipment order on. Zoho's own vocabulary: shipped, delivered. */
const setShipmentStatus = async (shipmentOrderId, action) => {
    if (!['shipped', 'delivered'].includes(action)) throw new Error(`Zoho has no shipment status "${action}"`)
    return call('post', `shipmentorders/${encodeURIComponent(shipmentOrderId)}/status/${action}`)
}

const getShipmentOrder = async (shipmentOrderId) =>
    (await call('get', `shipmentorders/${encodeURIComponent(shipmentOrderId)}`))?.shipmentorder ?? null

/** A custom field's value, whichever shape Zoho returned it in. */
const customField = (record, apiName) => {
    const hash = record?.custom_field_hash?.[apiName]
    if (hash !== undefined && hash !== null && hash !== '') return hash
    const list = Array.isArray(record?.custom_fields) ? record.custom_fields : []
    const hit = list.find((f) => f.api_name === apiName)
    return hit?.value ?? null
}

/**
 * Write the shipment back onto the sales order: the charge, and the fields the
 * order already has waiting for it — shipment id, tracking url, status.
 *
 * Zoho replaces line_items on a sales-order update, so the order is read back
 * and sent whole. Changing only the charge would empty the order — the kind of
 * mistake that is quiet until someone opens the invoice.
 *
 * Only the custom fields being set are sent. Echoing all of them back risks
 * rewriting values this flow has no business touching.
 */
const updateSalesOrderShipment = async (salesOrderId, { shippingCharge, customFields = {} } = {}) => {
    const order = await getSalesOrder(salesOrderId)

    const line_items = (Array.isArray(order.line_items) ? order.line_items : []).map((li) => ({
        line_item_id: li.line_item_id,
        item_id: li.item_id,
        name: li.name,
        rate: num(li.rate),
        quantity: num(li.quantity),
        ...(li.unit ? { unit: li.unit } : {}),
        ...(li.tax_id ? { tax_id: li.tax_id } : {}),
        ...(li.discount !== undefined && li.discount !== '' ? { discount: li.discount } : {})
    }))

    const custom_fields = Object.entries(customFields)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([api_name, value]) => ({ api_name, value: String(value) }))

    /* Never write an order that already says this.

       A workflow rule firing on every edit turns any needless write into a
       loop: we update the order, that counts as an edit, the rule calls us
       back, and we update it again. One redundant PUT is cheap; a thousand of
       them is an organisation's daily API quota.

       So compare first and return the order untouched when nothing differs. */
    const sameCharge =
        shippingCharge === undefined || Math.abs(num(order.shipping_charge) - num(shippingCharge)) < 0.005
    const sameFields = custom_fields.every((f) => String(customField(order, f.api_name) ?? '') === f.value)

    if (sameCharge && sameFields) {
        console.log(`[zoho] ${order.salesorder_number} already holds these values — not rewriting it`)
        return order
    }

    const body = await call('put', `salesorders/${encodeURIComponent(salesOrderId)}`, {
        data: {
            line_items,
            ...(shippingCharge === undefined ? {} : { shipping_charge: num(shippingCharge) }),
            ...(custom_fields.length ? { custom_fields } : {})
        }
    })
    return body?.salesorder ?? null
}

module.exports = {
    DEFAULT_ITEM_WEIGHT_KG,
    toKg,
    accessToken,
    call,
    getSalesOrder,
    getContact,
    findSalesOrderByNumber,
    getItemWeights,
    getNairaRate,
    createPackage,
    createShipmentOrder,
    setShipmentStatus,
    getShipmentOrder,
    customField,
    updateSalesOrderShipment
}
