const db = require('../models/db')
const zoho = require('../helpers/zohoInventory')
const shipmentsController = require('./shipmentsController')
const { trackingUrl: trackLink } = require('../helpers/shipmentStatus')

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

/* The field that now drives everything: Package Created raises the shipment,
   In Transit moves it, Fulfilled closes it. */
const STATUS_FIELD = process.env.ZOHO_SHIPMENT_STATUS_FIELD || 'cf_shipment_status'

/* The original flag. Kept because a rule somewhere may still set it, and
   because an order that carries it is unambiguously asking for a shipment.
   Nothing breaks when the field is deleted from Zoho — it simply never
   matches, and the status field answers instead. */
const TRIGGER_FIELD = process.env.ZOHO_SHIPMENT_TRIGGER_FIELD || 'cf_create_shipment'
const TRIGGER_VALUE = process.env.ZOHO_SHIPMENT_TRIGGER_VALUE || 'Via Obana'

// createShipment requires both, and only accepts these vocabularies.
/* shipment_trackings.source is an enum — system, driver, admin, carrier_api,
   customer. Writing 'zoho' throws, and the tracking event is created before the
   WhatsApp is sent, so every status change coming from Zoho died on that line
   and no notification was ever reached. The status itself had already been
   saved, which is why everything looked like it had worked.

   carrier_api is the value that means "an external system told us", which is
   exactly what this is. performed_by still records that it was Zoho. */
const TRACKING_SOURCE = 'carrier_api'

const TRANSPORT_MODE = process.env.ZOHO_TRANSPORT_MODE || 'road'
const SERVICE_LEVEL = process.env.ZOHO_SERVICE_LEVEL || 'Standard'

/* Zoho will not put a service item in a package, and a shipment order cannot
   exist without one. This catalogue is deliberately services — the marketplace
   does not hold inventory — so those records are off by default and the sales
   order's own fields carry the shipment instead: the charge, the reference, the
   tracking link and the status.

   Set ZOHO_CREATE_PACKAGES=true for an organisation whose items are goods and
   which wants Zoho's own packing records as well. */
const CREATE_PACKAGES = String(process.env.ZOHO_CREATE_PACKAGES || '').toLowerCase() === 'true'

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

/**
 * Pull a named value out of whatever Zoho sent.
 *
 * Query string first, since that is the part a workflow rule can reliably
 * populate. Then a JSON body. Then an XML one — Zoho's webhooks are XML, and a
 * rule configured to send its parameters in the body rather than the URL
 * arrives as a string neither body parser understands, so the value has to be
 * read out of the markup by hand.
 */
const param = (req, name) => {
    const fromQuery = str(req?.query?.[name])
    if (fromQuery) return fromQuery

    const body = req?.body
    if (body && typeof body === 'object') {
        const direct = str(body[name]) || str(body.salesorder?.[name])
        if (direct) return direct
    }

    if (typeof body === 'string' && body.includes(name)) {
        const tag = body.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'))
        if (tag) return str(tag[1])
        const field = body.match(new RegExp(`name=["']${name}["'][^>]*>\\s*<value>([^<]*)</value>`, 'i'))
        if (field) return str(field[1])
    }
    return null
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

/**
 * Whether this order is asking for a shipment.
 *
 * Two fields can say so, because two generations of workflow rule exist. The
 * original sets cf_create_shipment to "Via Obana". The current one drives
 * everything from cf_shipment_status, where "Package Created" is the request.
 *
 * Accepting both matters more than picking one: a rule pointed at this endpoint
 * while the order carries only a status answered 202 and silently did nothing,
 * which is the worst way for a configuration mismatch to present itself.
 */
const wantsObana = (order) => {
    const flag = triggerValueOf(order)
    if (flag && flag.trim().toLowerCase() === TRIGGER_VALUE.trim().toLowerCase()) return true

    // The status field, asking for the first stage.
    const status = str(zoho.customField(order, STATUS_FIELD))
    return Boolean(status) && toObanaStatus(status) === 'confirmed'
}

/** Zoho's shipping_address plus the order's contact, in the shape we book with. */
const deliveryAddressOf = (order, customer = null) => {
    /* An order's own address wins, but production orders routinely carry a
       blank one while the customer record behind them is filled in — the
       address was entered against the customer, not retyped onto every order.
       Falling through to the customer's address is the difference between a
       shipment and a refusal on an order that has everywhere to go.

       Judged on whether there is a street line, not on the object existing:
       Zoho returns the shape with empty strings rather than omitting it, so a
       blank address is truthy and would otherwise win over a real one. */
    const hasStreet = (a) => Boolean(str(a?.address) || str(a?.street))
    const address =
        [order.shipping_address, order.billing_address, customer?.shipping_address, customer?.billing_address].find(
            hasStreet
        ) ||
        order.shipping_address ||
        order.billing_address ||
        {}
    const name = str(order.customer_name) || ''
    const [first, ...rest] = name.split(/\s+/)
    const contact = Array.isArray(order.contact_persons_details) ? order.contact_persons_details[0] : null

    // A sales order routinely carries an address with no phone on it, while the
    // customer record it belongs to has one. A courier will not take a delivery
    // without a number, so fall through to the customer — still the customer on
    // this order, fetched by its own customer_id, never a search.
    const person = Array.isArray(customer?.contact_persons) ? customer.contact_persons[0] : null

    return {
        first_name: str(contact?.first_name) || str(first) || 'Customer',
        last_name: str(contact?.last_name) || str(rest.join(' ')) || '-',
        email: str(contact?.email) || str(order.email) || str(customer?.email) || str(person?.email) || null,
        phone:
            str(contact?.phone) ||
            str(contact?.mobile) ||
            str(address.phone) ||
            str(customer?.phone) ||
            str(customer?.mobile) ||
            str(person?.phone) ||
            str(person?.mobile) ||
            null,
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
const itemsOf = (order, weights) => {
    /* A shipment keeps its money in one currency — the shipping fee is priced
       in naira from the route templates, so the goods have to be naira too.
       Zoho prices these orders in the organisation's base currency, USD, and
       carries the customer's own currency and the day's rate alongside.

       Without converting, the same figure appears twice on one screen wearing
       two different symbols: US$253 an item, and a goods value of ₦1,265 that
       is really 1,265 dollars. */
    const base = String(order.currency_code || 'USD').toUpperCase()
    const display = String(zoho.customField(order, 'cf_currency_code') || 'NGN').toUpperCase()
    const rate = num(zoho.customField(order, 'cf_exchange_rate'))

    // Only convert when there is a rate to convert with, and something to
    // convert to. A missing rate leaves the figures as Zoho stated them, which
    // is wrong by a factor but not invented.
    const toNgn = display === 'NGN' && base !== 'NGN' && rate > 0 ? (v) => Math.round(num(v) * rate * 100) / 100 : (v) => num(v)
    const currency = display === 'NGN' && base !== 'NGN' && rate > 0 ? 'NGN' : base

    return (Array.isArray(order.line_items) ? order.line_items : []).map((li) => {
        /* rate times quantity, not item_total.

           Zoho stores item_total net of VAT — 272 at 7.5% is recorded as
           253.02 — while rate is the price the customer actually pays. A
           shipment declares what the goods are worth to whoever is carrying
           them, and that is the inclusive figure: ₦400,000, not ₦372,088.

           It also stopped the two halves of a line agreeing: the unit price was
           taken from rate and the line total from item_total, so one was
           inclusive and the other was not. */
        const quantity = num(li.quantity) || 1
        const unit = num(li.rate)
        const line = unit * quantity

        return {
            so_line_item_id: li.line_item_id,
            item_id: li.item_id,
            name: li.name || li.description || 'Item',
            description: str(li.description) || '',
            quantity,
            price: toNgn(unit),
            value: toNgn(line),
            total_price: toNgn(line),
            weight: weights.get(String(li.item_id)) ?? zoho.DEFAULT_ITEM_WEIGHT_KG,
            currency
        }
    })
}

/**
 * The store row Zoho shipments are tagged to, so they sit alongside the ones
 * the shop creates.
 *
 * Falls back to the only store there is when nothing is configured, and to no
 * store at all rather than refusing the order. A missing environment variable
 * is not a reason to drop a shipment someone in Zoho has asked for — it should
 * arrive, be visible to admin, and be re-tagged later.
 */
/**
 * The salesperson on the order, for the WhatsApp they get when a shipment is
 * raised and each time it moves.
 *
 * notifyShipmentEvent reads this from the shipment's metadata and skips the
 * message when there is no phone — silently, which is why nobody noticed. The
 * number lives on the sales order in cf_salesperson_phone and simply was not
 * being carried across.
 */
const salespersonOf = (order) => {
    const phone = str(zoho.customField(order, 'cf_salesperson_phone'))
    const name =
        str(order.salesperson_name) ||
        str(zoho.customField(order, 'cf_salesperson')) ||
        str(zoho.customField(order, 'cf_salesperson_name'))

    if (!phone && !name) return null
    return {
        name: name || 'Salesperson',
        // KudiSMS wants digits; Zoho may hold +234…, 234… or 0803…
        phone: phone ? phone.replace(/[^0-9]/g, '').replace(/^0/, '234') : null,
        email: str(zoho.customField(order, 'cf_email')) || str(zoho.customField(order, 'cf_agent_email'))
    }
}

const zohoStore = async () => {
    const id = Number(process.env.ZOHO_STORE_ID)
    if (id) {
        const byId = await db.stores.findByPk(id)
        if (byId) return byId
        console.warn(`[ZOHO SHIPMENT] ZOHO_STORE_ID=${id} matches no store — falling back`)
    }

    const byName = await db.stores.findOne({ where: { name: process.env.ZOHO_STORE_NAME || 'Zoho Inventory' } })
    if (byName) return byName

    const all = await db.stores.findAll({ where: { status: 'active' }, limit: 2 })
    if (all.length === 1) {
        console.warn(`[ZOHO SHIPMENT] no ZOHO_STORE_ID set — using the only active store, ${all[0].name} (${all[0].id})`)
        return all[0]
    }

    console.warn('[ZOHO SHIPMENT] no store resolved — the shipment will be created untagged. Set ZOHO_STORE_ID.')
    return null
}

/** Whoever the shipment is recorded against when no store owns it. */
const shipmentOwner = async (store) => {
    if (store?.owner_user_id) {
        const byStore = await db.users.findByPk(store.owner_user_id)
        if (byStore) return byStore
    }

    const configured = Number(process.env.ZOHO_OWNER_USER_ID)
    if (configured) {
        const byEnv = await db.users.findByPk(configured)
        if (byEnv) return byEnv
    }

    const anyStore = await db.stores.findOne({ where: { status: 'active' }, order: [['id', 'ASC']] })
    return anyStore ? db.users.findByPk(anyStore.owner_user_id) : null
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
    //
    // With no store at all the row still needs an owner. Roles live in
    // user_attributes here rather than on users, so there is no role column to
    // filter on — take the configured user, or fall back to whoever owns a
    // store, which is an operator by definition.
    const owner = await shipmentOwner(store)
    if (!owner) {
        throw new Error('No user available to own the shipment — set ZOHO_OWNER_USER_ID or ZOHO_STORE_ID')
    }

    const captured = {}
    const res = {
        status(code) { captured.status = code; return this },
        json(body) { captured.body = body; return this },
        send(body) { captured.body = body; return this }
    }
    await shipmentsController.createShipment(
        { body: payload, ...(store ? { store, authMethod: 'store_key' } : {}), user: owner },
        res
    )
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
    const salesOrderId = param(req, 'salesorder_id')
    const salesOrderNumber = param(req, 'salesorder_number')

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

    /* Zoho must be answered immediately — rating, booking and three write-backs
       will not finish inside its webhook timeout, and a timeout makes it record
       a failure for a shipment that in fact succeeded.
    
       `wait=1` runs it inline and returns the outcome instead. Not for Zoho: it
       is for whoever is setting this up, so a failure can be read from the
       response rather than hunted for in a log on another machine. */
    if (String(req.query?.wait || '') === '1') {
        try {
            const result = await resolveAndFulfil({ salesOrderId, salesOrderNumber })
            return res.status(200).json({ success: true, salesorder: reference, result })
        } catch (error) {
            console.error(`[ZOHO SHIPMENT] ${reference} failed:`, error?.zoho || error?.message || error)
            return res.status(502).json({
                success: false,
                salesorder: reference,
                error: error?.message || String(error),
                zoho: error?.zoho ?? null
            })
        }
    }

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
const fulfil = async (salesOrderId, { requireTriggerField = true } = {}) => {
    // Each stage announces itself. Every failure so far has been invisible
    // until someone read a log, and a 202 means the caller never sees any of
    // it — so the log has to be able to answer "how far did it get?" on its own.
    const step = (name, detail = '') => console.log(`[ZOHO SHIPMENT] ${salesOrderId} · ${name}${detail ? ' · ' + detail : ''}`)

    step('reading sales order')
    const order = await zoho.getSalesOrder(salesOrderId)
    step('read', `${order.salesorder_number} · ${order.customer_name} · ${(order.line_items || []).length} line(s)`)

    /* The shipment-status rule has already decided this order is being raised —
       it asked for Package Created — so it does not also have to carry the
       older cf_create_shipment flag. Orders arriving through the original
       trigger still do. */
    if (requireTriggerField && !wantsObana(order)) {
        console.log(
            `[ZOHO SHIPMENT] ${order.salesorder_number}: neither ${STATUS_FIELD} ("${str(zoho.customField(order, STATUS_FIELD)) ?? 'empty'}") ` +
                `nor ${TRIGGER_FIELD} is asking for a shipment — ignoring`
        )
        return { skipped: 'not_flagged' }
    }

    // One shipment per sales order. The rule fires on every edit, so without
    // this a second save books a second courier.
    const store = await zohoStore()
    step('store', store ? `${store.name} (${store.id})` : 'none — shipment will be untagged')

    // Scoped to the store: a sales order already shipped by another tenant is
    // not this integration's shipment, and skipping on it would silently refuse
    // an order Zoho has asked us to send.
    const existing = await db.shippings.findOne({
        where: { order_reference: order.salesorder_number, ...(store ? { tenant_id: store.id } : {}) }
    })
    if (existing) {
        /* Whether the write-back has happened is a question about the sales
           order, not about the shipment.

           It used to be read off external_shipment_id, which stays empty until
           the parcel actually ships — so on a rule that fires on every edit,
           every trigger decided the write-back was unfinished, rewrote the
           order, and that edit fired the rule again. A loop, six Zoho calls a
           pass, and an organisation's daily quota gone in an afternoon.

           The order says plainly whether it has been written: cf_shipment_id
           holds this shipment's reference once it has. */
        const written = String(zoho.customField(order, 'cf_shipment_id') ?? '') === existing.shipment_reference

        if (!written) {
            step('resuming write-back', existing.shipment_reference)
            const resume = await zoho.getItemWeights((order.line_items || []).map((li) => li.item_id))
            await writeBackToZoho({
                order,
                shipment: existing,
                feeNgn: num(existing.shipping_fee),
                defaulted: existing.metadata?.zoho?.weight_defaulted ?? resume.defaulted,
                productTypes: resume.productTypes
            })
            step('resumed', existing.shipment_reference)
            return { resumed: true, shipment_reference: existing.shipment_reference }
        }

        // Items written before the currency was corrected still hold dollars
        // against a naira shipment. A trigger on an order already shipped is
        // the natural moment to put that right.
        await repairItemCurrency(order, existing).catch((err) =>
            console.error('[ZOHO SHIPMENT] item re-pricing failed:', err.message)
        )

        // Already in both systems: the useful thing left is to check they agree.
        const sync = await reconcileFromZoho(order, existing).catch((err) => {
            console.error('[ZOHO SHIPMENT] reconcile failed:', err?.zoho || err?.message)
            return { reconciled: false }
        })
        step('already shipped', `${existing.shipment_reference}${sync.reconciled ? ` · moved to ${sync.status}` : ''}`)
        return { skipped: 'already_shipped', shipment_reference: existing.shipment_reference, ...sync }
    }

    const { weights, defaulted, productTypes } = await zoho.getItemWeights(
        (order.line_items || []).map((li) => li.item_id)
    )
    const items = itemsOf(order, weights)
    if (!items.length) throw new Error(`Sales order ${order.salesorder_number} has no line items to ship`)

    const totalKg = items.reduce((sum, i) => sum + (Number(i.weight) || 0) * (Number(i.quantity) || 1), 0)
    step('weights', `${totalKg} kg across ${items.length} line(s)` + (defaulted.length ? ` · ${defaulted.length} defaulted` : ''))

    // The order's own address often has no phone; its customer record does.
    const customer = order.customer_id
        ? await zoho.getContact(order.customer_id).catch((err) => {
              console.warn(`[ZOHO SHIPMENT] could not read customer ${order.customer_id}: ${err.message}`)
              return null
          })
        : null

    const delivery = deliveryAddressOf(order, customer)
    step('delivery', `${delivery.city}, ${delivery.state} · phone ${delivery.phone || 'MISSING'}`)
    if (!delivery.phone) {
        throw new Error(
            `No phone number for ${order.customer_name || 'the customer'} on ${order.salesorder_number} — ` +
                'a courier cannot collect without one. Add it to the contact in Zoho.'
        )
    }

    const booked = await bookShipment(
        {
            order_id: order.salesorder_number,
            vendor_name: 'Obana Africa',
            carrier_slug: 'obana',
            // createShipment validates both of these, and the quote option id
            // ties the price charged to the service level recorded.
            transport_mode: TRANSPORT_MODE,
            service_level: SERVICE_LEVEL,
            quote_option_id: `obana-${TRANSPORT_MODE}-${SERVICE_LEVEL.toLowerCase()}`,
            pickup_address: PICKUP,
            delivery_address: delivery,
            items,
            notes: `Zoho sales order ${order.salesorder_number}`,
            salesperson: salespersonOf(order),
            customer: {
                id: order.customer_id,
                name: order.customer_name,
                email: str(order.email),
                phone: str(order.shipping_address?.phone)
            }
        },
        store
    )

    step('booking', `HTTP ${booked.status}`)
    if (!booked.body?.success) {
        const errors = Array.isArray(booked.body?.errors) ? ` — ${booked.body.errors.join('; ')}` : ''
        throw new Error(`Booking refused: ${booked.body?.message || 'unknown'}${errors}`)
    }
    if (booked.body.duplicate) {
        return { skipped: 'already_shipped', shipment_reference: booked.body.data?.shipment_reference }
    }

    const shipment = await db.shippings.findByPk(booked.body.data.shipment_id)
    const feeNgn = num(shipment.shipping_fee)
    step('booked', `${shipment.shipment_reference} · ₦${feeNgn}`)

    step('writing back to zoho')
    await writeBackToZoho({ order, shipment, feeNgn, defaulted, productTypes })

    return {
        shipment_reference: shipment.shipment_reference,
        shipping_fee_ngn: feeNgn,
        // Whether the create messages actually went, per audience.
        notification: booked.body?.notification ?? null
    }
}

/**
 * Package, shipment order, shipping charge — in that order, because each
 * depends on the one before.
 *
 * The charge is converted at the rate Zoho itself holds for the day. A rate
 * from anywhere else — an env constant, a public feed — puts a number in the
 * books that the books do not agree with, and the order stops adding up.
 */
const writeBackToZoho = async ({ order, shipment, feeNgn, defaulted, productTypes = new Map() }) => {
    /* Zoho refuses a package dated before its sales order — "The package date
       should be on or after sales order date." Today in UTC can be yesterday in
       the org's own timezone, so an order raised this evening in Lagos is dated
       tomorrow as far as toISOString is concerned, and the package is refused
       for being a day early.
    
       Take whichever is later. ISO dates compare correctly as strings. */
    const today = new Date().toISOString().slice(0, 10)
    const orderDate = String(order.date || '').slice(0, 10)
    const date = orderDate && orderDate > today ? orderDate : today

    // Only goods can go in a Zoho package — "Hang on, you cannot package
    // services!" — and only the item master says which is which. A service line
    // is dropped from the package rather than failing the whole write-back, and
    // an order made entirely of services skips the package and shipment order
    // altogether. The shipment is real either way, so the order still gets its
    // charge, its shipment id and its tracking url.
    const packable = CREATE_PACKAGES
        ? (order.line_items || []).filter((li) => (productTypes.get(String(li.item_id)) ?? 'goods') !== 'service')
        : []
    const serviceLines = (order.line_items || []).length - packable.length

    let pkg = null
    let shipmentOrder = null

    // A sales order already carrying a package has been packed — by an earlier
    // run that failed on the way back, or by hand. Zoho counts the quantity as
    // recorded and refuses to pack it twice, so reuse what is there rather than
    // failing: the goal is an order that ends up correct, not one packed by us.
    const existingPackage = (Array.isArray(order.packages) ? order.packages : [])[0]
    if (existingPackage) {
        pkg = { package_id: existingPackage.package_id, package_number: existingPackage.package_number }
        if (existingPackage.shipment_id) {
            shipmentOrder = { shipmentorder_id: String(existingPackage.shipment_id) }
            console.log(
                `[ZOHO SHIPMENT] ${order.salesorder_number} already packed as ${existingPackage.package_number} ` +
                    `and shipped as ${existingPackage.shipment_id} — reusing both`
            )
        } else {
            console.log(`[ZOHO SHIPMENT] ${order.salesorder_number} already packed as ${existingPackage.package_number} — reusing it`)
        }
    } else if (packable.length) {
        pkg = await zoho.createPackage({
            salesOrderId: order.salesorder_id,
            date,
            lineItems: packable.map((li) => ({
                so_line_item_id: li.line_item_id,
                quantity: num(li.quantity)
            }))
        })
    } else {
        console.warn(
            `[ZOHO SHIPMENT] ${order.salesorder_number} is entirely service items — ` +
                'no Zoho package or shipment order can exist for it, recording on the order only'
        )
    }

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

    const trackingUrl = trackLink(shipment.shipment_reference)

    // No shipment order yet. A package that exists and has not left is Zoho's
    // "created", and it is the state the order is genuinely in between being
    // boxed and being collected. Shipping it early would report a parcel as
    // gone while it is still on the floor.


    // external_shipment_id is what updateZohoShipmentStatus reads when the
    // shipment later moves, so the outbound sync needs nothing more than this.
    await shipment.update({
        // Without a shipment order there is nothing for the status sync to
        // update, so the field stays empty rather than holding a fake id.
        ...(shipmentOrder ? { external_shipment_id: String(shipmentOrder.shipmentorder_id) } : {}),
        metadata: {
            ...(shipment.metadata || {}),
            zoho: {
                salesorder_id: order.salesorder_id,
                salesorder_number: order.salesorder_number,
                order_date: order.date ?? null,
                package_id: pkg?.package_id ?? null,
                shipmentorder_id: shipmentOrder?.shipmentorder_id ?? null,
                service_lines_skipped: serviceLines,
                status_label: ZOHO_LABEL.confirmed,
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
            cf_shipment_status: ZOHO_LABEL.confirmed,
            cf_carrier_name: 'Obana Logistics'
        }
    })

    if (pkg) {
        await db.shipment_tracking
            .create({
                shipment_id: shipment.id,
                status: 'created',
                description: `Package ${pkg.package_number ?? pkg.package_id} created in Zoho for ${order.salesorder_number}`,
                source: TRACKING_SOURCE,
                performed_by: 'zoho'
            })
            .catch((err) => console.warn('[ZOHO SHIPMENT] tracking event failed:', err.message))
    }

    console.log(
        `[ZOHO SHIPMENT] ${order.salesorder_number} → ${shipment.shipment_reference} · ` +
            `₦${feeNgn} = ${feeInBase} ${baseCurrency} @ ${rate} (${rateSource})` +
            ` · tracking ${trackingUrl}` +
            (defaulted.length ? ` · ${defaulted.length} line(s) used the default weight` : '')
    )
}

/**
 * Push an Obana status change onto the Zoho sales order.
 *
 * Zoho will not put a service item in a package, and a shipment order cannot
 * exist without one — so for a marketplace whose catalogue is services there is
 * no Zoho shipment record to move through statuses. The sales order's own
 * fields are the only place the status can live, and they are where anyone
 * working in Zoho looks anyway.
 *
 * Runs for every shipment that came from Zoho, alongside the shipment-order
 * status call for the orders that do have one.
 */
const syncStatusToSalesOrder = async (shipment, status) => {
    const salesOrderId = shipment?.metadata?.zoho?.salesorder_id
    if (!salesOrderId) return { skipped: 'not_a_zoho_shipment' }

    const label = ZOHO_LABEL[String(status || '').toLowerCase()]

    if (!label) return { skipped: `unmapped_status_${status}` }

    try {
        // Move Zoho's own records in step, not just the label on the order.
        if (label === 'Shipped' || label === 'Fulfilled') {
            const shipmentOrderId = await shipInZoho(shipment).catch((err) => {
                console.error(`[ZOHO SHIPMENT] could not ship ${shipment.shipment_reference} in Zoho:`, err?.zoho || err?.message)
                return null
            })
            if (shipmentOrderId && label === 'Fulfilled') {
                await zoho
                    .setShipmentStatus(shipmentOrderId, 'delivered')
                    .catch((err) => console.error('[ZOHO SHIPMENT] could not mark delivered:', err?.zoho || err?.message))
            }
        }

        await zoho.updateSalesOrderShipment(salesOrderId, {
            customFields: {
                cf_shipment_status: label,
                cf_shipment_id: shipment.shipment_reference,
                cf_tracking_url: trackLink(shipment.shipment_reference)
            }
        })
        // Keep the label on the shipment too, so the Obana side can show the
        // same word without every screen having to know the mapping.
        await shipment
            .update({ metadata: { ...(shipment.metadata || {}), zoho: { ...(shipment.metadata?.zoho ?? {}), status_label: label } } })
            .catch(() => {})

        console.log(`[ZOHO SHIPMENT] ${shipment.shipment_reference} → sales order ${salesOrderId} marked ${label}`)
        return { updated: true, status: label }
    } catch (error) {
        // Never let a Zoho hiccup fail an Obana status change; the shipment is
        // still moving and the order can be brought back into line on the next one.
        console.error(`[ZOHO SHIPMENT] could not mark ${salesOrderId} as ${label}:`, error?.zoho || error?.message)
        return { updated: false, error: error?.message ?? String(error) }
    }
}

/**
 * What Obana's statuses are called on the sales order.
 *
 * Deliberately Zoho's words, not ours. The workflow rules key off this field —
 * "Shipment Status is Shipped" — so writing anything else overwrites the value
 * the rule matched on, and whoever set it watches their own choice change to a
 * word Zoho never offered.
 *
 * The customer-facing wording is a separate decision and lives in
 * helpers/shipmentStatus: the dashboards and the tracking page say In Transit,
 * because that is what a person waiting for a parcel understands. Zoho says
 * Shipped because that is what its own lifecycle calls it. Two audiences, two
 * vocabularies, one underlying status.
 *
 * Obana tracks a parcel more finely than either — picked up, dispatched and in
 * transit are three things to a dispatcher and one thing to everyone else — so
 * they collapse, and the detail stays on the shipment's tracking history.
 *
 * Failed, cancelled and returned keep their own names: none of them is a stage
 * in the sequence, and saying so plainly matters more than a tidy set.
 */
const ZOHO_LABEL = {
    pending: 'Package Created',
    confirmed: 'Package Created',
    picked_up: 'In Transit',
    dispatched: 'In Transit',
    in_transit: 'In Transit',
    delivered: 'Fulfilled',
    failed: 'Failed',
    cancelled: 'Cancelled',
    returned: 'Returned'
}

/**
 * Raise the Zoho shipment order for a package already created.
 *
 * Called when the parcel actually leaves, not when it is booked, so Zoho's
 * package moves from created to shipped at the moment the real one does.
 */
const shipInZoho = async (shipment) => {
    const z = shipment?.metadata?.zoho ?? {}
    if (!z.salesorder_id || !z.package_id) return null
    if (z.shipmentorder_id) return String(z.shipmentorder_id)

    const trackingUrl = trackLink(shipment.shipment_reference)
    const order = await zoho.getSalesOrder(z.salesorder_id)
    const today = new Date().toISOString().slice(0, 10)
    const orderDate = String(order.date || '').slice(0, 10)

    const created = await zoho.createShipmentOrder({
        salesOrderId: z.salesorder_id,
        packageIds: [z.package_id],
        shipmentNumber: shipment.shipment_reference,
        trackingNumber: shipment.shipment_reference,
        deliveryMethod: 'Obana Logistics',
        shippingCharge: z.shipping_charge_base,
        date: orderDate && orderDate > today ? orderDate : today,
        notes: `Obana Logistics · ${trackingUrl}`
    })

    await shipment.update({
        external_shipment_id: String(created.shipmentorder_id),
        metadata: { ...(shipment.metadata || {}), zoho: { ...z, shipmentorder_id: created.shipmentorder_id } }
    })
    console.log(`[ZOHO SHIPMENT] ${shipment.shipment_reference} shipped in Zoho as ${created.shipmentorder_id}`)
    return String(created.shipmentorder_id)
}

/**
 * Re-price the stored items of a shipment raised before the currency was fixed.
 *
 * Those shipments hold dollar figures recorded against a naira shipment, so one
 * screen shows US$253 an item beside a goods value in naira that is really
 * dollars. Nothing recalculates them on its own — the items were written once at
 * booking — so a trigger on an order already shipped repairs them in passing.
 *
 * Only ever corrects: if the items already agree with the shipment's currency
 * there is nothing to do, and a run that cannot work out the rate leaves them
 * exactly as they are.
 */
const repairItemCurrency = async (order, shipment) => {
    const items = await db.shipment_items.findAll({ where: { shipment_id: shipment.id } })
    if (!items.length) return { repaired: 0 }

    const want = String(shipment.currency || 'NGN').toUpperCase()
    const stale = items.filter((i) => String(i.currency || '').toUpperCase() !== want)
    if (!stale.length) return { repaired: 0 }

    const rate = num(zoho.customField(order, 'cf_exchange_rate'))
    const base = String(order.currency_code || 'USD').toUpperCase()
    if (!(rate > 0) || base === want) {
        console.warn(`[ZOHO SHIPMENT] ${shipment.shipment_reference}: cannot re-price items without a rate — left alone`)
        return { repaired: 0, reason: 'no rate' }
    }

    /* Rebuilt from the order rather than scaled from what is stored. Those
       figures are wrong in two ways at once — the wrong currency, and a line
       total taken from item_total, which Zoho records net of VAT. Multiplying
       them by the rate would fix the first and preserve the second. */
    const byName = new Map((order.line_items || []).map((li) => [String(li.name || '').trim(), li]))

    let total = 0
    for (const item of stale) {
        const line = byName.get(String(item.name || '').trim())
        const quantity = num(item.quantity) || num(line?.quantity) || 1
        const unitBase = line ? num(line.rate) : num(item.unit_price)

        const unit = Math.round(unitBase * rate * 100) / 100
        const lineTotal = Math.round(unitBase * quantity * rate * 100) / 100
        await item.update({ unit_price: unit, total_price: lineTotal, currency: want })
        total += lineTotal
    }

    // product_value was summed from the same dollar figures.
    await shipment.update({ product_value: Math.round(total * 100) / 100 })

    console.log(
        `[ZOHO SHIPMENT] ${shipment.shipment_reference}: re-priced ${stale.length} item(s) from ${base} to ${want} at ${rate}`
    )
    return { repaired: stale.length, currency: want, product_value: total }
}

/**
 * Bring the Obana shipment into line with what Zoho actually holds.
 *
 * Someone shipping a package inside Zoho does not touch cf_shipment_status —
 * Zoho moves the package to "shipped" and raises a shipment order, and the
 * custom field still says Package Created. So a status webhook has nothing to
 * fire on, and the two systems drift apart while both look fine on their own
 * screen.
 *
 * Read the package and the shipment order instead. They are what Zoho means,
 * whatever any field says.
 *
 * Goes through updateShipmentStatus rather than writing the row, so the move
 * raises the tracking event and the notifications any other status change
 * would — a customer whose parcel was shipped from inside Zoho hears about it
 * exactly as one shipped from Obana does.
 */
const reconcileFromZoho = async (order, shipment) => {
    const pkg = (Array.isArray(order.packages) ? order.packages : [])[0]
    if (!pkg) return { reconciled: false, reason: 'no package in zoho' }

    let want = null
    if (String(pkg.status).toLowerCase() === 'shipped' && pkg.shipment_id) {
        const so = await zoho.getShipmentOrder(pkg.shipment_id).catch(() => null)
        const delivered =
            String(so?.status ?? '').toLowerCase() === 'delivered' ||
            String(so?.shipment_status ?? '').toLowerCase() === 'delivered' ||
            Boolean(so?.delivery_date)
        want = delivered ? 'delivered' : 'dispatched'
    } else if (String(pkg.status).toLowerCase() === 'delivered') {
        want = 'delivered'
    }

    if (!want || want === shipment.status) return { reconciled: false, status: shipment.status }

    // Obana may already be further along than Zoho — a driver marks delivered
    // before anyone updates the books. Never walk a shipment backwards.
    const ORDER = ['pending', 'confirmed', 'picked_up', 'dispatched', 'in_transit', 'delivered']
    if (ORDER.indexOf(want) <= ORDER.indexOf(shipment.status)) {
        return { reconciled: false, reason: 'obana is already further along', status: shipment.status }
    }

    // Record the Zoho shipment order if this is the first we have seen of it.
    if (pkg.shipment_id && !shipment.external_shipment_id) {
        await shipment.update({
            external_shipment_id: String(pkg.shipment_id),
            metadata: {
                ...(shipment.metadata || {}),
                zoho: { ...(shipment.metadata?.zoho ?? {}), package_id: pkg.package_id, shipmentorder_id: pkg.shipment_id }
            }
        })
    }

    const captured = {}
    const res = {
        status(code) { captured.status = code; return this },
        json(body) { captured.body = body; return this },
        send(body) { captured.body = body; return this }
    }
    await shipmentsController.updateShipmentStatus(
        {
            params: { shipment_id: String(shipment.id) },
            body: { status: want, source: TRACKING_SOURCE, performed_by: 'zoho', description: `Shipped in Zoho (${pkg.package_number})` },
            user: null
        },
        res
    )

    console.log(`[ZOHO SHIPMENT] ${shipment.shipment_reference} moved to ${want} to match Zoho`)
    return { reconciled: true, status: want }
}

/* ─────────────────── Zoho → Obana: a status set in Zoho ──────────────────── */

/** What Zoho (or a person typing in it) might say, and what Obana calls it. */
const INBOUND_STATUS = {
    'package created': 'confirmed',
    created: 'confirmed',
    shipped: 'dispatched',
    'shipment created': 'confirmed',
    confirmed: 'confirmed',
    pending: 'pending',
    packed: 'confirmed',
    'not shipped': 'confirmed',
    not_shipped: 'confirmed',
    'picked up': 'picked_up',
    picked_up: 'picked_up',
    pickedup: 'picked_up',
    dispatched: 'dispatched',
    shipped: 'dispatched',
    'in transit': 'in_transit',
    in_transit: 'in_transit',
    intransit: 'in_transit',
    delivered: 'delivered',
    fulfilled: 'delivered',
    fulfiled: 'delivered',
    created: 'confirmed',
    failed: 'failed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    returned: 'returned'
}

const toObanaStatus = (value) => INBOUND_STATUS[String(value || '').trim().toLowerCase()] ?? null

/**
 * The endpoint Zoho calls when someone changes a shipment's status there.
 *
 * The two systems have to agree in both directions: a shipment marked
 * delivered in Zoho is delivered, and Obana should say so without anyone
 * re-typing it. Runs through updateShipmentStatus rather than writing the row,
 * so the change lands with a tracking event and the same notifications any
 * other status change would raise.
 */
const statusFromZoho = async (req, res) => {
    const salesOrderNumber = param(req, 'salesorder_number')
    const salesOrderId = param(req, 'salesorder_id')
    const rawStatus = param(req, 'status') || param(req, 'shipment_status') || param(req, 'cf_shipment_status')

    if (!salesOrderNumber && !salesOrderId) {
        return res.status(400).json({
            success: false,
            message: 'salesorder_id or salesorder_number is required — add it as a URL parameter on the workflow rule'
        })
    }
    if (!rawStatus) {
        return res.status(400).json({
            success: false,
            message: 'status is required — add status=${SALESORDER.CF_SHIPMENT_STATUS} as a URL parameter'
        })
    }

    /* Deliberately synchronous.

       It was taking about seven seconds, most of it spent reporting the change
       back to Zoho — three or four API calls to tell Zoho something Zoho had
       just told us. With from_zoho set, that work is skipped and what remains
       is a lookup, a row update and the two WhatsApp sends.

       Answering early would have been the easy fix, but it moves the work into
       a background task nobody can see: if the process is recycled or the
       instance spins down after replying, the status never moves and no log
       says why. Doing it in the request is slower to admit failure and far
       harder to lose. */
    const status = toObanaStatus(rawStatus)
    if (!status) {
        // Not an error: Zoho carries statuses Obana has no equivalent for, and
        // a rule that fires on every edit will send them.
        console.log(`[ZOHO STATUS] "${rawStatus}" has no Obana equivalent — ignoring`)
        return res.status(200).json({ success: true, ignored: `unmapped status "${rawStatus}"` })
    }

    try {
        // Find the shipment by whichever reference Zoho sent.
        let shipment = null
        if (salesOrderNumber) {
            shipment = await db.shippings.findOne({ where: { order_reference: salesOrderNumber } })
        }
        if (!shipment && salesOrderId) {
            const order = await zoho.getSalesOrder(salesOrderId)
            shipment = await db.shippings.findOne({ where: { order_reference: order.salesorder_number } })
        }

        if (!shipment) {
            /* A placeholder Zoho did not resolve arrives as its own literal
               text. The lookup then fails on a sales order that does not exist,
               and Zoho reports the webhook as sent — so the rule looks fine, the
               log looks quiet, and nothing happens. Name it. */
            const unresolved = [salesOrderNumber, salesOrderId].find((v) => v && v.includes('${'))
            if (unresolved) {
                console.error(`[ZOHO STATUS] the workflow rule sent an unresolved placeholder: ${unresolved}`)
                return res.status(400).json({
                    success: false,
                    message:
                        `Zoho sent "${unresolved}" literally — that placeholder did not resolve. ` +
                        'Use salesorder_id=${SALESORDER.SALESORDER_ID}, which is the one the create rule uses.'
                })
            }

            /* No shipment yet, and Zoho is reporting the first stage — so this
               is the order being raised, not a status moving. One field then
               drives the whole flow: Package Created makes the shipment, In
               Transit moves it, Fulfilled closes it.

               That matters because the catalogue is services. Zoho will not
               pack a service, so its own package and shipment-order records can
               never exist here, and cf_shipment_status is the only place the
               lifecycle can live. */
            if (status === 'confirmed') {
                const id = salesOrderId || (await zoho.findSalesOrderByNumber(salesOrderNumber))
                if (!id) {
                    return res.status(404).json({ success: false, message: `No sales order ${salesOrderNumber} in Zoho` })
                }

                console.log(`[ZOHO STATUS] no shipment for ${salesOrderNumber || id} yet — raising it from "${rawStatus}"`)
                const created = await fulfil(id, { requireTriggerField: false })
                return res.status(200).json({ success: true, created: true, from_zoho: rawStatus, ...created })
            }

            console.warn(
                `[ZOHO STATUS] no Obana shipment for ${salesOrderNumber || salesOrderId} — ` +
                    `"${rawStatus}" cannot move a shipment that was never raised`
            )
            return res.status(404).json({
                success: false,
                message: `No Obana shipment for ${salesOrderNumber || salesOrderId}`,
                received: { salesorder_number: salesOrderNumber, salesorder_id: salesOrderId, status: rawStatus }
            })
        }

        if (shipment.status === status) {
            return res.status(200).json({ success: true, unchanged: true, status, shipment_reference: shipment.shipment_reference })
        }

        /* Never walk a shipment backwards.
        
           A rule that fires on every edit re-sends whatever the field happens to
           say, so a delivered parcel gets "Shipped" again the next time anyone
           touches the order — and a driver marks delivered long before the books
           catch up. Moving it back would un-deliver a parcel that has arrived,
           re-notify the customer, and leave the dashboard lying.
        
           The exceptions are not part of the sequence: failed, cancelled and
           returned can happen from anywhere and are never a step back. */
        const PROGRESSION = ['pending', 'confirmed', 'picked_up', 'dispatched', 'in_transit', 'delivered']
        const from = PROGRESSION.indexOf(shipment.status)
        const to = PROGRESSION.indexOf(status)
        if (to !== -1 && from !== -1 && to < from) {
            console.log(
                `[ZOHO STATUS] ${shipment.shipment_reference} is already ${shipment.status}; ` +
                    `ignoring "${rawStatus}" from Zoho rather than moving it back to ${status}`
            )
            return res.status(200).json({
                success: true,
                ignored: 'would move the shipment backwards',
                status: shipment.status,
                shipment_reference: shipment.shipment_reference
            })
        }

        const captured = {}
        const inner = {
            status(code) { captured.status = code; return this },
            json(body) { captured.body = body; return this },
            send(body) { captured.body = body; return this }
        }
        await shipmentsController.updateShipmentStatus(
            {
                params: { shipment_id: String(shipment.id) },
                body: {
                    status,
                    source: TRACKING_SOURCE,
                    performed_by: 'zoho',
                    description: `Marked ${rawStatus} in Zoho`,
                    // Zoho told us this. Do not spend API calls telling it back.
                    from_zoho: true
                },
                user: null
            },
            inner
        )

        console.log(`[ZOHO STATUS] ${shipment.shipment_reference} → ${status} (from Zoho "${rawStatus}")`)
        return res.status(captured.status ?? 200).json({
            success: true,
            shipment_reference: shipment.shipment_reference,
            status,
            from_zoho: rawStatus,
            // What the WhatsApp actually did, per audience.
            notification: captured.body?.notification ?? null
        })
    } catch (error) {
        console.error('[ZOHO STATUS] failed:', error?.zoho || error?.message || error)
        return res.status(500).json({ success: false, error: error?.message ?? String(error) })
    }
}

/**
 * Which WhatsApp templates are configured, and which are not.
 *
 * A missing template is the quietest failure in the system: notifyShipmentEvent
 * skips that audience with a console warning and returns as if it had sent, so
 * the only symptom is a message nobody receives. This reports what is set
 * without printing any of it — the codes are credentials.
 */
/**
 * Which Zoho Books contact a phone number or email resolves to.
 *
 * Reads only: it never creates a contact, an estimate or anything else. It
 * exists because "a new customer was created again" is the one symptom that
 * cannot be diagnosed from outside — the answer is several API calls deep, and
 * every guess about it so far has cost a deploy to disprove.
 *
 * Returns the exact spellings tried and which one matched, so a number that
 * plainly exists in Books and still does not match can be seen rather than
 * theorised about.
 */
const contactProbe = async (req, res) => {
    const invoice = require('../helpers/zohoShipmentInvoice')
    const phone = str(req.query.phone)
    const email = str(req.query.email)

    if (!phone && !email) {
        return res.status(400).json({ success: false, message: 'Pass ?phone= or ?email= (or both)' })
    }

    const variants = invoice.phoneVariants(phone)
    const attempts = []

    if (email) {
        const found = await zoho
            .call('get', 'contacts', { params: { email }, books: true })
            .catch((err) => ({ error: err?.zoho?.message || err.message }))
        const hit = (found?.contacts || [])[0]
        attempts.push({ by: 'email', value: email, matched: hit ? hit.contact_name : null, contact_id: hit?.contact_id ?? null, error: found?.error })
    }

    for (const candidate of variants) {
        const found = await zoho
            .call('get', 'contacts', { params: { phone: candidate }, books: true })
            .catch((err) => ({ error: err?.zoho?.message || err.message }))
        const hit = (found?.contacts || [])[0]
        attempts.push({ by: 'phone', value: candidate, matched: hit ? hit.contact_name : null, contact_id: hit?.contact_id ?? null, error: found?.error })
        if (hit) break
    }

    const winner = attempts.find((a) => a.contact_id)
    return res.status(200).json({
        success: true,
        phone_as_given: phone || null,
        phone_variants_tried: variants,
        attempts,
        result: winner
            ? `would reuse ${winner.matched} (matched by ${winner.by} ${winner.value})`
            : 'no match — a new contact would be created'
    })
}

const notificationConfig = async (_req, res) => {
    const { templateCodeFor } = require('./shipmentsController')

    const events = {
        created: ['KUDISMS_WA_CREATED_TEMPLATE', 'KUDISMS_WA_SALESPERSON_CREATED_TEMPLATE'],
        in_transit: ['KUDISMS_WA_INTRANSIT_TEMPLATE', 'KUDISMS_WA_SALESPERSON_INTRANSIT_TEMPLATE'],
        delivered: ['KUDISMS_WA_DELIVERED_TEMPLATE', 'KUDISMS_WA_SALESPERSON_DELIVERED_TEMPLATE']
    }

    const report = {}
    const missing = []
    for (const [event, [customer, salesperson]] of Object.entries(events)) {
        // Through the same lookup the sender uses, so an alias counts as set.
        const has = (name) => Boolean(templateCodeFor(name))
        report[event] = { customer: has(customer), salesperson: has(salesperson) }
        if (!has(customer)) missing.push(customer)
        if (!has(salesperson)) missing.push(salesperson)
    }

    // A template is useless without the account behind it.
    const account = {
        KUDISMS_API_KEY: Boolean(String(process.env.KUDISMS_API_KEY || '').trim()),
        KUDISMS_WHATSAPP_PHONE_NUMBER_ID: Boolean(String(process.env.KUDISMS_WHATSAPP_PHONE_NUMBER_ID || '').trim())
    }
    for (const [name, set] of Object.entries(account)) if (!set) missing.push(name)

    return res.status(200).json({
        success: true,
        configured: report,
        account,
        missing,
        note: missing.length
            ? 'Those are unset, so that audience is silently skipped for that event.'
            : 'Every template and credential is configured.'
    })
}

module.exports = {
    triggerFromSalesOrder,
    repairItemCurrency,
    notificationConfig,
    contactProbe,
    reconcileFromZoho,
    statusFromZoho,
    shipInZoho,
    salespersonOf,
    ZOHO_LABEL,
    toObanaStatus,
    resolveAndFulfil,
    fulfil,
    syncStatusToSalesOrder,
    wantsObana,
    deliveryAddressOf,
    itemsOf,
    PICKUP
}
