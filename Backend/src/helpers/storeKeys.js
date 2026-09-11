const crypto = require('crypto')

// Store API keys: "obk_live_<random>". Only the SHA-256 hash is stored; the key is shown to the owner once.
const KEY_PREFIX = 'obk_live_'

const hashKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex')

const newApiKey = () => {
    const key = KEY_PREFIX + crypto.randomBytes(24).toString('base64url')
    return { key, hash: hashKey(key), hint: `${KEY_PREFIX}…${key.slice(-4)}` }
}

// Shared secret the store uses to check our webhook signatures.
const newWebhookSecret = () => 'whsec_' + crypto.randomBytes(24).toString('base64url')

const isStoreKey = (token) => typeof token === 'string' && token.startsWith('obk_')

module.exports = { KEY_PREFIX, hashKey, newApiKey, newWebhookSecret, isStoreKey }
