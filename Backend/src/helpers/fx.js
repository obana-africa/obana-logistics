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
const LOCAL = {
    // Africa
    NG: 'NGN', ZA: 'ZAR', GH: 'GHS', KE: 'KES', EG: 'EGP', MA: 'MAD', TZ: 'TZS', UG: 'UGX',
    RW: 'RWF', ET: 'ETB', ZM: 'ZMW', BW: 'BWP', NA: 'NAD', MU: 'MUR', TN: 'TND', DZ: 'DZD',
    AO: 'AOA', MZ: 'MZN', ZW: 'ZWL', MW: 'MWK', MG: 'MGA', BI: 'BIF', DJ: 'DJF', ER: 'ERN',
    LS: 'LSL', SZ: 'SZL', CV: 'CVE', ST: 'STN', GM: 'GMD', GN: 'GNF', SL: 'SLE', LR: 'LRD',
    SD: 'SDG', SS: 'SSP', SO: 'SOS', LY: 'LYD', MR: 'MRU', SC: 'SCR', KM: 'KMF', CD: 'CDF',
    // CFA franc: West African (XOF) and Central African (XAF)
    BJ: 'XOF', BF: 'XOF', CI: 'XOF', GW: 'XOF', ML: 'XOF', NE: 'XOF', SN: 'XOF', TG: 'XOF',
    CM: 'XAF', CF: 'XAF', TD: 'XAF', CG: 'XAF', GQ: 'XAF', GA: 'XAF',
    // East and South Asia
    CN: 'CNY', HK: 'HKD', MO: 'MOP', TW: 'TWD', JP: 'JPY', KR: 'KRW', MN: 'MNT', IN: 'INR',
    PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', BT: 'BTN', MV: 'MVR', AF: 'AFN', SG: 'SGD',
    MY: 'MYR', ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP', BN: 'BND', KH: 'KHR', LA: 'LAK',
    MM: 'MMK',
    // Middle East and Central Asia
    AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', YE: 'YER', IL: 'ILS',
    JO: 'JOD', LB: 'LBP', SY: 'SYP', IQ: 'IQD', IR: 'IRR', TR: 'TRY', KZ: 'KZT', UZ: 'UZS',
    TM: 'TMT', KG: 'KGS', TJ: 'TJS', AZ: 'AZN', GE: 'GEL', AM: 'AMD',
    // Europe beyond the euro
    GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK',
    HU: 'HUF', RO: 'RON', BG: 'BGN', UA: 'UAH', RU: 'RUB', BY: 'BYN', MD: 'MDL', RS: 'RSD',
    MK: 'MKD', AL: 'ALL', BA: 'BAM', GI: 'GIP', FO: 'FOK', GG: 'GGP', JE: 'JEP', IM: 'IMP',
    // The Americas
    US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
    UY: 'UYU', PY: 'PYG', BO: 'BOB', VE: 'VES', GY: 'GYD', SR: 'SRD', CR: 'CRC', GT: 'GTQ',
    HN: 'HNL', NI: 'NIO', PA: 'PAB', BZ: 'BZD', SV: 'USD', EC: 'USD', DO: 'DOP', JM: 'JMD',
    HT: 'HTG', CU: 'CUP', TT: 'TTD', BS: 'BSD', BB: 'BBD', KY: 'KYD', BM: 'BMD', AW: 'AWG',
    AG: 'XCD', DM: 'XCD', GD: 'XCD', KN: 'XCD', LC: 'XCD', VC: 'XCD',
    // Oceania
    AU: 'AUD', NZ: 'NZD', FJ: 'FJD', PG: 'PGK', SB: 'SBD', VU: 'VUV', WS: 'WST', TO: 'TOP',
    PF: 'XPF', NC: 'XPF'
}

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
