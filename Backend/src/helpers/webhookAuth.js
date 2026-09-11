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

module.exports = { requireWebhookSecret }
