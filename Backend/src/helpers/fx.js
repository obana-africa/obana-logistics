const axios = require('axios')

// Exchange rates with NGN as the base (open.er-api.com: free, no key, updated daily).
// Cached for 6 hours. If rates can't be fetched, quotes are shown in NGN only.
const FX_URL = process.env.FX_RATES_URL || 'https://open.er-api.com/v6/latest/NGN'
const TTL_MS = 6 * 60 * 60 * 1000

let cache = null // { fetchedAt, rates, asOf, source }
let inflight = null

const getNgnRates = async () => {
    if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache
    if (!inflight) {
        inflight = axios.get(FX_URL, { timeout: 5000 })
            .then(({ data }) => {
                if (data && data.result === 'success' && data.rates) {
                    cache = {
                        fetchedAt: Date.now(),
                        rates: data.rates,
                        asOf: data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString() : new Date().toISOString(),
                        source: 'open.er-api.com'
                    }
                }
            })
            .catch((error) => console.error('FX rates unavailable:', error.message))
            .finally(() => { inflight = null })
    }
    await inflight
    return cache // may be a stale cache, or null
}

const EUROZONE = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES']
const LOCAL = { GB: 'GBP', US: 'USD', CA: 'CAD', NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN' }

/** The currency a sender in this country most likely thinks in. */
const currencyForCountry = (countryCode) => {
    const code = String(countryCode || '').toUpperCase()
    if (EUROZONE.includes(code)) return 'EUR'
    return LOCAL[code] || 'USD'
}

/** { rate, as_of, source } for 1 NGN in `currency`, or null when unknown/unavailable. */
const ngnRate = async (currency) => {
    const code = String(currency || '').toUpperCase()
    if (!code || code === 'NGN') return null
    const fx = await getNgnRates()
    const rate = fx && fx.rates && Number(fx.rates[code])
    return rate ? { rate, as_of: fx.asOf, source: fx.source } : null
}

module.exports = { getNgnRates, currencyForCountry, ngnRate }
