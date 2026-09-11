const { Op } = require('sequelize')
const db = require('../models/db')
const utils = require('../../utils')
const { newApiKey, newWebhookSecret } = require('../helpers/storeKeys')
const { sendTestEvent, shipmentForStore, isPublicWebhookUrl } = require('../helpers/storeWebhooks')

// Business stores: each belongs to a signed-in owner and calls the API with its own key.

const MAX_STORES_PER_OWNER = 10
const STATUSES = ['active', 'paused']

const text = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null)

const serialize = (store, { withSecret = true } = {}) => ({
    id: store.id,
    name: store.name,
    website_url: store.website_url,
    status: store.status,
    api_key_hint: store.api_key_hint,
    api_key_created_at: store.api_key_created_at,
    last_used_at: store.last_used_at,
    webhook_url: store.webhook_url,
    ...(withSecret ? { webhook_secret: store.webhook_secret } : {}),
    created_at: store.createdAt
})

/** { value } or { error } for an optional URL field. */
const checkUrl = (value, { webhook = false } = {}) => {
    if (value === undefined) return {}
    if (value === null || value === '') return { value: null }
    let url
    try {
        url = new URL(String(value).trim())
    } catch {
        return { error: 'Enter a full address starting with https://' }
    }
    if (!['https:', 'http:'].includes(url.protocol)) return { error: 'Enter a full address starting with https://' }
    if (webhook) {
        if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return { error: 'The webhook address must start with https://' }
        if (!isPublicWebhookUrl(url)) return { error: 'The webhook address must be reachable on the public internet' }
    }
    return { value: url.toString().slice(0, 500) }
}

/** The store in :id if the signed-in user owns it (or is admin). Store keys can't manage stores. */
const ownedStore = async (req, res) => {
    if (req.store) {
        res.status(403).send(utils.responseError('Store API keys can’t manage stores. Sign in to your Obana account instead.'))
        return null
    }
    const store = await db.stores.findByPk(req.params.id)
    if (!store || (Number(store.owner_user_id) !== Number(req.user.id) && req.user.role !== 'admin')) {
        res.status(404).send(utils.responseError('Store not found'))
        return null
    }
    return store
}

const countByStore = async (storeIds) => {
    if (!storeIds.length) return {}
    const rows = await db.shippings.findAll({
        attributes: ['tenant_id', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
        where: { tenant_id: storeIds },
        group: ['tenant_id'],
        raw: true
    })
    return Object.fromEntries(rows.map((r) => [r.tenant_id, Number(r.count)]))
}

/** GET /stores — my stores (admins: ?all=1 for every store with its owner). */
const listStores = async (req, res) => {
    if (req.store) return res.status(403).send(utils.responseError('Use /stores/me with a store API key.'))
    try {
        const all = req.user.role === 'admin' && String(req.query.all) === '1'
        const stores = await db.stores.findAll({ where: all ? {} : { owner_user_id: req.user.id }, order: [['created_at', 'DESC']] })
        const counts = await countByStore(stores.map((s) => s.id))
        let owners = {}
        if (all && stores.length) {
            const users = await db.users.findAll({ where: { id: [...new Set(stores.map((s) => s.owner_user_id))] }, attributes: ['id', 'email', 'phone'] })
            owners = Object.fromEntries(users.map((u) => [u.id, { id: u.id, email: u.email, phone: u.phone }]))
        }
        return res.status(200).send(utils.responseSuccess(stores.map((s) => ({
            ...serialize(s, { withSecret: !all }),
            shipments_count: counts[s.id] || 0,
            ...(all ? { owner: owners[s.owner_user_id] || { id: s.owner_user_id } } : {})
        }))))
    } catch (error) {
        console.error('List stores failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load your stores'))
    }
}

/** POST /stores { name, website_url?, webhook_url? } — the API key is returned once. */
const createStore = async (req, res) => {
    if (req.store) return res.status(403).send(utils.responseError('Store API keys can’t create stores.'))
    const name = text(req.body && req.body.name, 120)
    if (!name || name.length < 2) return res.status(400).send(utils.responseError('Give the store a name (at least 2 characters).'))
    const website = checkUrl(req.body && req.body.website_url)
    if (website.error) return res.status(400).send(utils.responseError(`Website: ${website.error}`))
    const webhook = checkUrl(req.body && req.body.webhook_url, { webhook: true })
    if (webhook.error) return res.status(400).send(utils.responseError(`Webhook: ${webhook.error}`))
    try {
        const owned = await db.stores.count({ where: { owner_user_id: req.user.id } })
        if (owned >= MAX_STORES_PER_OWNER) return res.status(400).send(utils.responseError(`You can connect up to ${MAX_STORES_PER_OWNER} stores. Contact us if you need more.`))
        const key = newApiKey()
        const store = await db.stores.create({
            owner_user_id: req.user.id,
            name,
            website_url: website.value || null,
            webhook_url: webhook.value || null,
            status: 'active',
            api_key_hash: key.hash,
            api_key_hint: key.hint,
            api_key_created_at: new Date(),
            webhook_secret: newWebhookSecret()
        })
        return res.status(201).send(utils.responseSuccess({ store: serialize(store), api_key: key.key }))
    } catch (error) {
        console.error('Create store failed:', error.message)
        return res.status(500).send(utils.responseError('Could not create the store'))
    }
}

/** GET /stores/:id — the store plus shipment counts by status. */
const getStore = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    try {
        const rows = await db.shippings.findAll({
            attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
            where: { tenant_id: store.id },
            group: ['status'],
            raw: true
        })
        const by_status = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]))
        const total = Object.values(by_status).reduce((a, b) => a + b, 0)
        return res.status(200).send(utils.responseSuccess({ ...serialize(store), stats: { total, by_status } }))
    } catch (error) {
        console.error('Get store failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load the store'))
    }
}

/** PUT /stores/:id { name?, website_url?, webhook_url?, status? } */
const updateStore = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    const body = req.body || {}
    const changes = {}
    if (body.name !== undefined) {
        const name = text(body.name, 120)
        if (!name || name.length < 2) return res.status(400).send(utils.responseError('Give the store a name (at least 2 characters).'))
        changes.name = name
    }
    const website = checkUrl(body.website_url)
    if (website.error) return res.status(400).send(utils.responseError(`Website: ${website.error}`))
    if ('value' in website) changes.website_url = website.value
    const webhook = checkUrl(body.webhook_url, { webhook: true })
    if (webhook.error) return res.status(400).send(utils.responseError(`Webhook: ${webhook.error}`))
    if ('value' in webhook) changes.webhook_url = webhook.value
    if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return res.status(400).send(utils.responseError('status must be active or paused'))
        changes.status = body.status
    }
    if (!Object.keys(changes).length) return res.status(400).send(utils.responseError('Nothing to update'))
    try {
        await store.update(changes)
        return res.status(200).send(utils.responseSuccess(serialize(store)))
    } catch (error) {
        console.error('Update store failed:', error.message)
        return res.status(500).send(utils.responseError('Could not update the store'))
    }
}

/** POST /stores/:id/rotate-key — the old key stops working immediately; the new one is returned once. */
const rotateKey = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    try {
        const key = newApiKey()
        await store.update({ api_key_hash: key.hash, api_key_hint: key.hint, api_key_created_at: new Date(), last_used_at: null })
        return res.status(200).send(utils.responseSuccess({ store: serialize(store), api_key: key.key }))
    } catch (error) {
        console.error('Rotate store key failed:', error.message)
        return res.status(500).send(utils.responseError('Could not create a new key'))
    }
}

/** POST /stores/:id/webhook-secret — new signing secret. */
const rotateWebhookSecret = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    try {
        await store.update({ webhook_secret: newWebhookSecret() })
        return res.status(200).send(utils.responseSuccess(serialize(store)))
    } catch (error) {
        console.error('Rotate webhook secret failed:', error.message)
        return res.status(500).send(utils.responseError('Could not create a new secret'))
    }
}

/** POST /stores/:id/test-webhook — sends a signed webhook.test event now. */
const testWebhook = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    if (!store.webhook_url) return res.status(400).send(utils.responseError('Add a webhook address first.'))
    try {
        const result = await sendTestEvent(db, store)
        return res.status(200).send(utils.responseSuccess(result))
    } catch (error) {
        console.error('Test webhook failed:', error.message)
        return res.status(500).send(utils.responseError('Could not send the test event'))
    }
}

/** GET /stores/:id/webhooks — the last 50 deliveries. */
const listDeliveries = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    try {
        const rows = await db.store_webhook_deliveries.findAll({
            where: { store_id: store.id },
            order: [['id', 'DESC']],
            limit: 50,
            attributes: ['id', 'event', 'shipment_id', 'status', 'attempts', 'response_code', 'next_attempt_at', 'delivered_at', 'created_at']
        })
        return res.status(200).send(utils.responseSuccess(rows))
    } catch (error) {
        console.error('List webhook deliveries failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load webhook history'))
    }
}

/** Shipments of one store, with filters. Used by the owner dashboard and by store keys. */
const findStoreShipments = async (store, query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
    const where = { tenant_id: store.id }
    if (query.status) where.status = String(query.status)
    if (query.order_id) where.order_reference = String(query.order_id)
    if (query.customer_id) where['metadata.store_customer.id'] = String(query.customer_id)
    if (query.q) {
        const like = `%${String(query.q).trim().slice(0, 80)}%`
        where[Op.or] = [{ shipment_reference: { [Op.iLike]: like } }, { order_reference: { [Op.iLike]: like } }]
    }
    const { rows, count } = await db.shippings.findAndCountAll({
        where,
        include: [{ model: db.addresses, as: 'delivery_address', attributes: ['name', 'city', 'state', 'country'] }],
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
        distinct: true
    })
    return {
        shipments: rows.map((s) => ({
            ...shipmentForStore(s),
            destination: s.delivery_address ? { name: s.delivery_address.name, city: s.delivery_address.city, state: s.delivery_address.state, country: s.delivery_address.country } : null
        })),
        pagination: { total: count, page, pages: Math.ceil(count / limit), limit }
    }
}

/** GET /stores/:id/shipments?status=&order_id=&customer_id=&q=&page=&limit= */
const storeShipments = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    try {
        return res.status(200).send(utils.responseSuccess(await findStoreShipments(store, req.query)))
    } catch (error) {
        console.error('Store shipments failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load shipments'))
    }
}

/** GET /stores/:id/customers — the store's customers, built from their shipments. */
const storeCustomers = async (req, res) => {
    const store = await ownedStore(req, res)
    if (!store) return
    try {
        const rows = await db.shippings.findAll({
            where: { tenant_id: store.id },
            include: [{ model: db.addresses, as: 'delivery_address', attributes: ['name', 'phone', 'contact_email', 'city', 'state', 'country'] }],
            attributes: ['id', 'status', 'shipping_fee', 'currency', 'metadata', 'createdAt'],
            order: [['createdAt', 'DESC']],
            limit: 2000
        })
        const closed = ['delivered', 'failed', 'cancelled', 'returned']
        const customers = new Map()
        for (const s of rows) {
            const c = (s.metadata && s.metadata.store_customer) || {}
            const a = s.delivery_address || {}
            const key = c.id ? `id:${c.id}` : c.email || a.contact_email ? `email:${String(c.email || a.contact_email).toLowerCase()}` : `phone:${c.phone || a.phone || s.id}`
            if (!customers.has(key)) {
                customers.set(key, {
                    customer_id: c.id || null,
                    name: c.name || a.name || null,
                    email: c.email || a.contact_email || null,
                    phone: c.phone || a.phone || null,
                    city: a.city || null,
                    country: a.country || null,
                    shipments: 0,
                    delivered: 0,
                    in_progress: 0,
                    total_fees: 0,
                    last_shipment_at: s.createdAt
                })
            }
            const entry = customers.get(key)
            entry.shipments += 1
            if (s.status === 'delivered') entry.delivered += 1
            else if (!closed.includes(s.status)) entry.in_progress += 1
            entry.total_fees += Number(s.shipping_fee) || 0
        }
        return res.status(200).send(utils.responseSuccess([...customers.values()].slice(0, 200)))
    } catch (error) {
        console.error('Store customers failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load customers'))
    }
}

/** GET /stores/me — for a store API key: which store am I? (handy to test a key). */
const currentStore = async (req, res) => {
    if (!req.store) return res.status(400).send(utils.responseError('Call this with a store API key (Authorization: Bearer obk_live_…).'))
    return res.status(200).send(utils.responseSuccess(serialize(req.store, { withSecret: false })))
}

/** GET /stores/me/shipments — the key's own store shipments, same filters as the dashboard. */
const currentStoreShipments = async (req, res) => {
    if (!req.store) return res.status(400).send(utils.responseError('Call this with a store API key (Authorization: Bearer obk_live_…).'))
    try {
        return res.status(200).send(utils.responseSuccess(await findStoreShipments(req.store, req.query)))
    } catch (error) {
        console.error('Store key shipments failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load shipments'))
    }
}

module.exports = {
    listStores,
    createStore,
    getStore,
    updateStore,
    rotateKey,
    rotateWebhookSecret,
    testWebhook,
    listDeliveries,
    storeShipments,
    storeCustomers,
    currentStore,
    currentStoreShipments
}
