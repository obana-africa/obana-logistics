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

/**
 * The money a sender in this country thinks in — ISO 3166 to ISO 4217.
 *
 * Written out rather than looked up, because nothing already installed
 * carries it: country-code-lookup knows the country but not its currency.
 *
 * It used to be twelve countries with a dollar fallback, which meant a
 * shipper in Shanghai was quoted in dollars and a shipper in Dubai too — the
 * one thing a forwarder's quote must not get wrong is the currency, because
 * the customer prices it against local competitors in local money. Anywhere
 * missing still falls back to the dollar, but the list now covers the places
 * Obana actually collects from.
 */
const LOCAL = {
    // Africa
    NG: 'NGN', ZA: 'ZAR', GH: 'GHS', KE: 'KES', EG: 'EGP', MA: 'MAD', TZ: 'TZS', UG: 'UGX',
    RW: 'RWF', ET: 'ETB', ZM: 'ZMW', BW: 'BWP', NA: 'NAD', MU: 'MUR', TN: 'TND', DZ: 'DZD',
    AO: 'AOA', MZ: 'MZN', ZW: 'ZWL', CI: 'XOF', SN: 'XOF', CM: 'XAF', GA: 'XAF',
    // Asia
    CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW', IN: 'INR', PK: 'PKR', BD: 'BDT',
    LK: 'LKR', SG: 'SGD', MY: 'MYR', ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP',
    AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', IL: 'ILS',
    TR: 'TRY', JO: 'JOD', LB: 'LBP',
    // Europe beyond the euro
    GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
    HU: 'HUF', RO: 'RON', BG: 'BGN', UA: 'UAH', RU: 'RUB', IS: 'ISK', RS: 'RSD',
    // Americas and Oceania
    US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP',
    PE: 'PEN', AU: 'AUD', NZ: 'NZD'
}

/**
 * The currency a sender in this country thinks in.
 *
 * The dollar is the fallback for a country not listed and for one we cannot
 * read at all — it is the currency international freight is most often quoted
 * in, and a figure in dollars is at least one the sender can convert.
 */
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
