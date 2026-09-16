const db = require('../models/db')
const zoho = require('../helpers/zohoInventory')
const shipmentsController = require('./shipmentsController')

// Zoho → Obana: raising a shipment from a sales order.
//
// Zoho's Create Shipment button only reaches carriers Zoho itself integrates,
// and Obana will not be on that list. So ops sets cf_create_shipment on the
// sales order instead, a Zoho workflow rule calls the endpoint below, and we do
// the rest: read the order, weigh it, price it, book it, and write the package,
// the shipment order and the shipping charge back into Zoho.
//
// The booking itself is not reimplemented here. It goes through the same
// createShipment the connected stores use, so a Zoho order is rated, dedup'd,
// tracked and dispatched by exactly the code that already does that — this file
// only translates between a Zoho sales order and the payload it expects.

const TRIGGER_FIELD = process.env.ZOHO_SHIPMENT_TRIGGER_FIELD || 'cf_create_shipment'
const TRIGGER_VALUE = process.env.ZOHO_SHIPMENT_TRIGGER_VALUE || 'Via Obana'

// Goods ship from the Obana warehouse. Vendor drop-ships do not come through
// this door — an order raised from inside Zoho is one ops is packing here.
const PICKUP = {
    first_name: 'Obana',
    last_name: 'Africa',
    email: process.env.OBANA_PICKUP_EMAIL || 'support@obana.com',
    phone: process.env.OBANA_PICKUP_PHONE || '+2348090335245',
    is_residential: false,
    line1: '77 Opebi Road',
    line2: 'Ikeja',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'NG',
    country_code: 'NG',
    zip_code: '100001'
}

const str = (value) => {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text === '' ? null : text
}

const num = (value) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

/** Zoho sends the trigger field as a hash, as a list, or by label. Accept all. */
const triggerValueOf = (order) => {
    const hash = order?.custom_field_hash?.[TRIGGER_FIELD]
    if (hash !== undefined && hash !== null && hash !== '') return String(hash)

    const fields = Array.isArray(order?.custom_fields) ? order.custom_fields : []
    const match = fields.find(
        (f) => f.api_name === TRIGGER_FIELD || f.placeholder === TRIGGER_FIELD || /create\s*shipment/i.test(f.label || '')
    )
    return str(match?.value)
}

const wantsObana = (order) => {
    const value = triggerValueOf(order)
    if (!value) return false
    return value.trim().toLowerCase() === TRIGGER_VALUE.trim().toLowerCase()
}

/** Zoho's shipping_address plus the order's contact, in the shape we book with. */
const deliveryAddressOf = (order) => {
    const address = order.shipping_address || order.billing_address || {}
    const name = str(order.customer_name) || ''
    const [first, ...rest] = name.split(/\s+/)
    const contact = Array.isArray(order.contact_persons_details) ? order.contact_persons_details[0] : null

    return {
        first_name: str(contact?.first_name) || str(first) || 'Customer',
        last_name: str(contact?.last_name) || str(rest.join(' ')) || '-',
        email: str(contact?.email) || str(order.email) || null,
        phone: str(contact?.phone) || str(contact?.mobile) || str(address.phone) || null,
        is_residential: true,
        line1: str(address.address) || str(address.street) || '',
        line2: str(address.street2) || '',
        city: str(address.city) || '',
        state: str(address.state) || '',
        country: str(address.country) || 'Nigeria',
        country_code: str(address.country_code) || 'NG',
        zip_code: str(address.zip) || ''
    }
}

/**
 * Sales-order lines as shipment items, carrying the weight Zoho holds for each.
 *
 * Weight is per unit; createShipment multiplies by quantity when it rates. The
 * lines that had no cf_weight are returned separately so the shipment can record
 * that it guessed — an unnoticed default is how a heavy item quietly ships at a
 * light item's price, for months.
 */
const itemsOf = (order, weights) =>
    (Array.isArray(order.line_items) ? order.line_items : []).map((li) => ({
        so_line_item_id: li.line_item_id,
        item_id: li.item_id,
        name: li.name || li.description || 'Item',
        description: str(li.description) || '',
        quantity: num(li.quantity) || 1,
        price: num(li.rate),
        value: num(li.item_total ?? li.rate),
        total_price: num(li.item_total),
        weight: weights.get(String(li.item_id)) ?? zoho.DEFAULT_ITEM_WEIGHT_KG,
        currency: order.currency_code || 'USD'
    }))

/** The store row the Zoho integration books as, so shipments are tagged to it. */
const zohoStore = async () => {
    const id = Number(process.env.ZOHO_STORE_ID)
    if (id) {
        const byId = await db.stores.findByPk(id)
        if (byId) return byId
    }
    return db.stores.findOne({ where: { name: process.env.ZOHO_STORE_NAME || 'Zoho Inventory' } })
}

/**
 * Run createShipment without letting it answer the caller.
 *
 * Zoho's webhook needs a reply of its own once the write-back is done, and the
 * shipment has to exist before any of that can happen. So the response is
 * captured here rather than sent.
 */
const bookShipment = async (payload, store) => {
    // A store's own API call arrives with both req.user (the store's owner) and
    // req.store set, and createShipment refuses anything with neither. So the
    // owner is loaded here too — without it every booking is turned away as
    // unauthenticated, and the shipment silently never exists.
    const owner = await db.users.findByPk(store.owner_user_id)
    if (!owner) throw new Error(`Store ${store.id} has no owner user ${store.owner_user_id}`)

    const captured = {}
    const res = {
        status(code) { captured.status = code; return this },
        json(body) { captured.body = body; return this },
        send(body) { captured.body = body; return this }
    }
    await shipmentsController.createShipment({ body: payload, store, user: owner, authMethod: 'store_key' }, res)
    return { status: captured.status ?? 200, body: captured.body ?? {} }
}

/**
 * The endpoint Zoho's workflow rule calls.
 *
 * Answers immediately and does the work after. Rating, booking and three
 * write-backs will not finish inside Zoho's webhook timeout, and a timeout
 * makes Zoho record a failure for a shipment that in fact succeeded — which
 * then invites someone to trigger it a second time.
 */
const triggerFromSalesOrder = async (req, res) => {
    // Zoho sends nothing on its own. A workflow-rule webhook carries only the
    // URL parameters and body you configure on it, and its body format is XML,
    // which express.json() leaves as an empty object — so in practice the id
    // arrives as a query parameter. Both are accepted, and so is the human
    // order number, because that is the field most people reach for first.
    const salesOrderId =
        str(req.query?.salesorder_id) ||
        str(req.body?.salesorder_id) ||
        str(req.body?.salesorder?.salesorder_id)

    const salesOrderNumber =
        str(req.query?.salesorder_number) ||
        str(req.body?.salesorder_number) ||
        str(req.body?.salesorder?.salesorder_number)

    if (!salesOrderId && !salesOrderNumber) {
        // Say what did arrive. A bare "salesorder_id is required" tells whoever
        // is configuring the rule nothing about which half is missing, and this
        // is the one error they will hit while setting it up.
        console.warn(
            '[ZOHO SHIPMENT] trigger arrived with no sales order —',
            `query=${JSON.stringify(req.query || {})}`,
            `content-type=${req.headers?.['content-type'] || 'none'}`,
            `body=${JSON.stringify(req.body || {}).slice(0, 300)}`
        )
        return res.status(400).json({
            success: false,
            message:
                'salesorder_id is required. Zoho sends only what the webhook is configured to send: add ' +
                'salesorder_id=${SALESORDER.SALESORDER_ID} as a URL parameter on the workflow rule.',
            received: { query: req.query || {}, content_type: req.headers?.['content-type'] || null }
        })
    }

    const reference = salesOrderId || salesOrderNumber
    res.status(202).json({ success: true, message: 'Shipment request accepted', salesorder: reference })

    resolveAndFulfil({ salesOrderId, salesOrderNumber }).catch((error) =>
        console.error(`[ZOHO SHIPMENT] ${reference} failed:`, error?.zoho || error?.message || error)
    )
}

/** Turn whatever Zoho sent into an id, then run the flow. */
const resolveAndFulfil = async ({ salesOrderId, salesOrderNumber }) => {
    let id = salesOrderId
    if (!id && salesOrderNumber) {
        id = await zoho.findSalesOrderByNumber(salesOrderNumber)
        if (!id) throw new Error(`No sales order in Zoho numbered ${salesOrderNumber}`)
        console.log(`[ZOHO SHIPMENT] ${salesOrderNumber} resolved to sales order ${id}`)
    }
    return fulfil(id)
}

/**
 * Read the order, book the shipment, write the result back to Zoho.
 *
 * Exported so the same path can be replayed by hand for an order whose webhook
 * was lost or whose write-back failed halfway.
 */
const fulfil = async (salesOrderId) => {
    const order = await zoho.getSalesOrder(salesOrderId)

    if (!wantsObana(order)) {
        console.log(`[ZOHO SHIPMENT] ${order.salesorder_number}: ${TRIGGER_FIELD} is not "${TRIGGER_VALUE}" — ignoring`)
        return { skipped: 'not_flagged' }
    }

    // One shipment per sales order. The rule fires on every edit, so without
    // this a second save books a second courier.
    const existing = await db.shippings.findOne({ where: { order_reference: order.salesorder_number } })
    if (existing) {
        console.log(`[ZOHO SHIPMENT] ${order.salesorder_number} already has ${existing.shipment_reference} — ignoring`)
        return { skipped: 'already_shipped', shipment_reference: existing.shipment_reference }
    }

    const store = await zohoStore()
    if (!store) throw new Error('No store row for the Zoho integration — set ZOHO_STORE_ID')

    const { weights, defaulted } = await zoho.getItemWeights(
        (order.line_items || []).map((li) => li.item_id)
    )
    const items = itemsOf(order, weights)
    if (!items.length) throw new Error(`Sales order ${order.salesorder_number} has no line items to ship`)

    const booked = await bookShipment(
        {
            order_id: order.salesorder_number,
            vendor_name: 'Obana Africa',
            carrier_slug: 'obana',
            pickup_address: PICKUP,
            delivery_address: deliveryAddressOf(order),
            items,
            notes: `Zoho sales order ${order.salesorder_number}`,
            customer: {
                id: order.customer_id,
                name: order.customer_name,
                email: str(order.email),
                phone: str(order.shipping_address?.phone)
            }
        },
        store
    )

    if (!booked.body?.success) {
        throw new Error(`Booking refused: ${booked.body?.message || 'unknown'}`)
    }
    if (booked.body.duplicate) {
        return { skipped: 'already_shipped', shipment_reference: booked.body.data?.shipment_reference }
    }

    const shipment = await db.shippings.findByPk(booked.body.data.shipment_id)
    const feeNgn = num(shipment.shipping_fee)

    await writeBackToZoho({ order, shipment, feeNgn, defaulted })

    return { shipment_reference: shipment.shipment_reference, shipping_fee_ngn: feeNgn }
}

/**
 * Package, shipment order, shipping charge — in that order, because each
 * depends on the one before.
 *
 * The charge is converted at the rate Zoho itself holds for the day. A rate
 * from anywhere else — an env constant, a public feed — puts a number in the
 * books that the books do not agree with, and the order stops adding up.
 */
const writeBackToZoho = async ({ order, shipment, feeNgn, defaulted }) => {
    const date = new Date().toISOString().slice(0, 10)

    const pkg = await zoho.createPackage({
        salesOrderId: order.salesorder_id,
        date,
        lineItems: (order.line_items || []).map((li) => ({
            so_line_item_id: li.line_item_id,
            quantity: num(li.quantity)
        }))
    })

    // The rate the order itself was priced at, when it carries one. Every other
    // figure on this order was converted with cf_exchange_rate; converting the
    // shipping charge with anything else makes the order stop adding up, however
    // correct the other number is. Zoho's currency settings are the fallback for
    // an order raised without it.
    const orderRate = Number(zoho.customField(order, 'cf_exchange_rate'))
    const rateSource = orderRate > 0 ? 'salesorder.cf_exchange_rate' : 'zoho_currency_settings'
    const { rate, effective_date } =
        orderRate > 0
            ? { rate: orderRate, effective_date: order.date ?? null }
            : await zoho.getNairaRate(date)

    const baseCurrency = String(order.currency_code || 'USD').toUpperCase()
    const feeInBase = baseCurrency === 'NGN' ? feeNgn : Number((feeNgn / rate).toFixed(2))

    const trackingUrl = `${process.env.FRONTEND_URL || 'https://logistics.obana.africa'}/track/${shipment.shipment_reference}`

    const shipmentOrder = await zoho.createShipmentOrder({
        salesOrderId: order.salesorder_id,
        packageIds: [pkg.package_id],
        shipmentNumber: shipment.shipment_reference,
        trackingNumber: shipment.shipment_reference,
        deliveryMethod: 'Obana Logistics',
        shippingCharge: feeInBase,
        date,
        notes: `Obana Logistics · ${trackingUrl}`
    })

    // external_shipment_id is what updateZohoShipmentStatus reads when the
    // shipment later moves, so the outbound sync needs nothing more than this.
    await shipment.update({
        external_shipment_id: String(shipmentOrder.shipmentorder_id),
        metadata: {
            ...(shipment.metadata || {}),
            zoho: {
                salesorder_id: order.salesorder_id,
                salesorder_number: order.salesorder_number,
                package_id: pkg.package_id,
                shipmentorder_id: shipmentOrder.shipmentorder_id,
                shipping_charge_base: feeInBase,
                base_currency: baseCurrency,
                ngn_rate: rate,
                rate_source: rateSource,
                rate_effective_date: effective_date,
                // Which lines had no cf_weight and shipped at the default. Left
                // here deliberately: it is the only trace of a price that was
                // guessed rather than measured.
                weight_defaulted: defaulted
            }
        }
    })

    // The order already carries fields waiting for this: Shipment Id, Tracking
    // URL, Shipment Status. Filling them is what makes the shipment visible to
    // whoever opens the order in Zoho, rather than only to us.
    await zoho.updateSalesOrderShipment(order.salesorder_id, {
        shippingCharge: feeInBase,
        customFields: {
            cf_shipment_id: shipment.shipment_reference,
            cf_tracking_url: trackingUrl,
            cf_shipment_status: 'Shipment Created',
            cf_carrier_name: 'Obana Logistics'
        }
    })

    console.log(
        `[ZOHO SHIPMENT] ${order.salesorder_number} → ${shipment.shipment_reference} · ` +
            `₦${feeNgn} = ${feeInBase} ${baseCurrency} @ ${rate} (${rateSource})` +
            ` · tracking ${trackingUrl}` +
            (defaulted.length ? ` · ${defaulted.length} line(s) used the default weight` : '')
    )
}

module.exports = { triggerFromSalesOrder, resolveAndFulfil, fulfil, wantsObana, deliveryAddressOf, itemsOf, PICKUP }
