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

/** Find a sales order by its human number (SO-00042) rather than its id. */
const findSalesOrderByNumber = async (salesOrderNumber) => {
    const body = await call('get', 'salesorders', { params: { salesorder_number: salesOrderNumber } })
    const list = Array.isArray(body?.salesorders) ? body.salesorders : []
    const hit = list.find((o) => String(o.salesorder_number) === String(salesOrderNumber)) || list[0]
    return hit?.salesorder_id ? String(hit.salesorder_id) : null
}

/**
 * Weight in kilograms for each item, read from the cf_weight custom field.
 *
 * Fetched for the whole order in one call rather than one per line. Items with
 * no cf_weight fall back to DEFAULT_ITEM_WEIGHT_KG and are reported in
 * `defaulted` — a silent default is how an under-quoted shipment becomes a
 * standing loss nobody can trace, so the caller records which items guessed.
 */
const getItemWeights = async (itemIds) => {
    const ids = [...new Set((itemIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
    const weights = new Map()
    const defaulted = []
    if (!ids.length) return { weights, defaulted }

    const body = await call('get', 'itemdetails', { params: { item_ids: ids.join(',') } })
    const items = Array.isArray(body?.items) ? body.items : []

    for (const item of items) {
        const id = String(item.item_id)
        const raw =
            item.custom_field_hash?.cf_weight ??
            (Array.isArray(item.custom_fields)
                ? item.custom_fields.find((f) => f.api_name === 'cf_weight' || /weight/i.test(f.label || ''))?.value
                : undefined)

        const parsed = Number.parseFloat(raw)
        if (Number.isFinite(parsed) && parsed > 0) {
            weights.set(id, parsed)
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

    return { weights, defaulted }
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
    const rate = num(chosen?.exchange_rate)
    if (rate <= 0) throw new Error('Zoho returned an NGN exchange rate of zero')

    return { rate, effective_date: chosen.effective_date ?? null, used_fallback: !inForce }
}

/* ────────────────────────────────── writes ───────────────────────────────── */

/** The box: which sales-order lines, and how many of each. */
const createPackage = async ({ salesOrderId, lineItems, date, packageNumber }) => {
    const body = await call('post', 'packages', {
        params: { salesorder_id: salesOrderId },
        data: {
            date: date || new Date().toISOString().slice(0, 10),
            ...(packageNumber ? { package_number: packageNumber } : {}),
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
    const shipment = body?.shipmentorder ?? body?.shipment_order
    if (!shipment?.shipmentorder_id) throw new Error('Zoho created no shipment order')
    return shipment
}

/** Move a shipment order on. Zoho's own vocabulary: shipped, delivered. */
const setShipmentStatus = async (shipmentOrderId, action) => {
    if (!['shipped', 'delivered'].includes(action)) throw new Error(`Zoho has no shipment status "${action}"`)
    return call('post', `shipmentorders/${encodeURIComponent(shipmentOrderId)}/status/${action}`)
}

const getShipmentOrder = async (shipmentOrderId) =>
    (await call('get', `shipmentorders/${encodeURIComponent(shipmentOrderId)}`))?.shipmentorder ?? null

/**
 * Put the shipping charge on the sales order.
 *
 * Zoho replaces line_items on a sales-order update, so the order is read back
 * and sent whole. Changing only the charge would empty the order — the kind of
 * mistake that is quiet until someone opens the invoice.
 */
const setSalesOrderShippingCharge = async (salesOrderId, shippingCharge) => {
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

    const body = await call('put', `salesorders/${encodeURIComponent(salesOrderId)}`, {
        data: { line_items, shipping_charge: num(shippingCharge) }
    })
    return body?.salesorder ?? null
}

module.exports = {
    DEFAULT_ITEM_WEIGHT_KG,
    accessToken,
    call,
    getSalesOrder,
    findSalesOrderByNumber,
    getItemWeights,
    getNairaRate,
    createPackage,
    createShipmentOrder,
    setShipmentStatus,
    getShipmentOrder,
    setSalesOrderShippingCharge
}
