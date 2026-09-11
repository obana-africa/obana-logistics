const crypto = require('crypto')
const dns = require('dns').promises
const net = require('net')
const axios = require('axios')

// Webhooks to connected stores. Every event is stored, signed and retried with backoff.
//   Headers: Obana-Event, Obana-Delivery (id), Obana-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the store's webhook secret>

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://logistics.obana.africa'
const RETRY_DELAYS_MS = [60e3, 5 * 60e3, 30 * 60e3, 2 * 3600e3, 6 * 3600e3] // then give up
const TIMEOUT_MS = 8000

// Never let a store point webhooks at our own network (localhost, private ranges, cloud metadata).
const isPrivateIp = (ip) => {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number)
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    }
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase()
        if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
        return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
    }
    return true
}

const isPublicWebhookUrl = (url) => {
    const host = String(url.hostname || '').replace(/^\[|\]$/g, '')
    if (!host || /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) return false
    if (net.isIP(host)) return !isPrivateIp(host)
    return true
}

const resolvesToPublic = async (rawUrl) => {
    if (process.env.ALLOW_PRIVATE_WEBHOOKS === 'true') return true
    const url = new URL(rawUrl)
    if (!isPublicWebhookUrl(url)) return false
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (net.isIP(host)) return true
    const addresses = await dns.lookup(host, { all: true })
    return addresses.length > 0 && addresses.every((a) => !isPrivateIp(a.address))
}

const sign = (secret, timestamp, body) => crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

/** What a store receives about a shipment (never internal notes or partner costs). */
const shipmentForStore = (s) => {
    const meta = s.metadata || {}
    return {
        id: s.id,
        reference: s.shipment_reference,
        order_id: s.order_reference,
        status: s.status,
        customer: meta.store_customer || null,
        carrier: s.carrier_type === 'external' ? { type: 'partner', name: s.carrier_name || null, tracking_number: s.external_carrier_reference || null } : { type: 'obana', name: 'Obana Logistics' },
        shipping_fee: s.shipping_fee !== undefined && s.shipping_fee !== null ? Number(s.shipping_fee) : null,
        currency: s.currency || 'NGN',
        tracking_url: `${FRONTEND_URL}/?track=${encodeURIComponent(s.shipment_reference)}`,
        created_at: s.createdAt,
        updated_at: s.updatedAt
    }
}

/** Send one delivery now; records the outcome and schedules a retry on failure. */
const attempt = async (delivery, store) => {
    const body = JSON.stringify(delivery.payload)
    const timestamp = Math.floor(Date.now() / 1000)
    let code = null
    let text = null
    try {
        if (!(await resolvesToPublic(store.webhook_url))) throw new Error('Webhook address is not on the public internet')
        const response = await axios.post(store.webhook_url, body, {
            timeout: TIMEOUT_MS,
            maxRedirects: 0,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Obana-Webhooks/1.0',
                'Obana-Event': delivery.event,
                'Obana-Delivery': String(delivery.id),
                'Obana-Signature': `t=${timestamp},v1=${sign(store.webhook_secret, timestamp, body)}`
            }
        })
        code = response.status
        text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '')
    } catch (error) {
        text = error.code || error.message
    }

    const attempts = delivery.attempts + 1
    const ok = code !== null && code >= 200 && code < 300
    const nextDelay = RETRY_DELAYS_MS[attempts - 1]
    await delivery.update({
        attempts,
        response_code: code,
        response_body: String(text || '').slice(0, 500),
        status: ok ? 'delivered' : nextDelay ? 'pending' : 'failed',
        delivered_at: ok ? new Date() : null,
        next_attempt_at: ok || !nextDelay ? null : new Date(Date.now() + nextDelay)
    })
    return { ok, code }
}

const queueEvent = async (db, shipment, event) => {
    if (!shipment || !shipment.tenant_id) return null
    const store = await db.stores.findByPk(shipment.tenant_id)
    if (!store || store.status !== 'active' || !store.webhook_url) return null
    const delivery = await db.store_webhook_deliveries.create({
        store_id: store.id,
        shipment_id: shipment.id,
        event,
        payload: { id: `evt_${crypto.randomBytes(12).toString('hex')}`, event, created_at: new Date().toISOString(), data: { shipment: shipmentForStore(shipment) } },
        status: 'pending',
        next_attempt_at: new Date()
    })
    attempt(delivery, store).catch((error) => console.error('Store webhook failed:', error.message))
    return delivery
}

/** Owner-triggered test from the dashboard; returns the result straight away. */
const sendTestEvent = async (db, store) => {
    const delivery = await db.store_webhook_deliveries.create({
        store_id: store.id,
        event: 'webhook.test',
        payload: { id: `evt_${crypto.randomBytes(12).toString('hex')}`, event: 'webhook.test', created_at: new Date().toISOString(), data: { message: 'Test event from Obana Logistics', store: { id: store.id, name: store.name } } },
        status: 'pending'
    })
    const result = await attempt(delivery, store)
    // A failed test shouldn't keep retrying in the background.
    if (!result.ok) await delivery.update({ status: 'failed', next_attempt_at: null })
    return { ...result, delivery_id: delivery.id }
}

let retryTimer = null

/** Fire webhooks whenever a store shipment is created or its status changes (all code paths), and retry failures. */
const registerStoreWebhooks = (db) => {
    const later = (options, fn) => {
        const run = () => fn().catch((error) => console.error('Store webhook error:', error.message))
        if (options && options.transaction) options.transaction.afterCommit(run)
        else run()
    }
    db.shippings.addHook('afterCreate', 'storeWebhookCreated', (shipment, options) => {
        if (shipment.tenant_id) later(options, () => queueEvent(db, shipment, 'shipment.created'))
    })
    db.shippings.addHook('afterUpdate', 'storeWebhookUpdated', (shipment, options) => {
        if (shipment.tenant_id && shipment.changed('status')) later(options, () => queueEvent(db, shipment, 'shipment.updated'))
    })

    if (!retryTimer) {
        retryTimer = setInterval(async () => {
            try {
                const { Op } = db.Sequelize
                const due = await db.store_webhook_deliveries.findAll({
                    where: { status: 'pending', next_attempt_at: { [Op.lte]: new Date() }, attempts: { [Op.gt]: 0 } },
                    order: [['next_attempt_at', 'ASC']],
                    limit: 20
                })
                for (const delivery of due) {
                    const store = await db.stores.findByPk(delivery.store_id)
                    if (!store || store.status !== 'active' || !store.webhook_url) {
                        await delivery.update({ status: 'failed', next_attempt_at: null })
                        continue
                    }
                    await attempt(delivery, store)
                }
            } catch (error) {
                console.error('Store webhook retry loop:', error.message)
            }
        }, 60 * 1000)
        retryTimer.unref()
    }
}

module.exports = { sign, shipmentForStore, queueEvent, sendTestEvent, registerStoreWebhooks, attempt, isPublicWebhookUrl, resolvesToPublic }
