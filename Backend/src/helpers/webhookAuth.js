const crypto = require('crypto')

// Shared-secret check for inbound webhooks (Zoho). Off until WEBHOOK_SECRET is set, so nothing
// breaks before the secret is added in Zoho. Zoho can send it as a header or a URL parameter.
const requireWebhookSecret = (req, res, next) => {
    const secret = process.env.WEBHOOK_SECRET
    if (!secret) return next()
    const given = Buffer.from(String(req.headers['x-webhook-secret'] || req.query.secret || ''))
    const expected = Buffer.from(secret)
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next()
    return res.status(401).json({ success: false, message: 'Invalid webhook secret' })
}

/**
 * Shared-secret check for calls from another Obana service (Tajiri), not from Zoho.
 *
 * Deliberately its own secret rather than WEBHOOK_SECRET. That one lives in
 * Zoho's workflow rules and has to be rotated there by hand; sharing it would
 * mean rotating the Zoho webhooks and the vendor dashboard at the same moment,
 * and whichever is forgotten fails silently.
 *
 * Unlike the webhook check this does NOT fall open when unset: a service that
 * can move a customer's shipment status is not something to leave unguarded
 * because an environment variable is missing.
 */
const requireServiceSecret = (req, res, next) => {
    const secret = String(process.env.TAJIRI_SERVICE_SECRET || '').trim()
    if (!secret) {
        return res.status(503).json({
            success: false,
            message: 'TAJIRI_SERVICE_SECRET is not configured on this service'
        })
    }
    const given = Buffer.from(String(req.headers['x-service-secret'] || '').trim())
    const expected = Buffer.from(secret)
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next()
    return res.status(401).json({ success: false, message: 'Invalid service secret' })
}

module.exports = { requireWebhookSecret, requireServiceSecret }
