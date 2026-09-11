// Partner-carrier pricing: which partners we offer and the markup we add to their rates.
// Settings live in the `partners` table (admin → Partners & markup).

const DEFAULT_SLUG = '__default__'

const slugify = (name) =>
    String(name || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown'

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

const envDefaultPercent = () => toNumber(process.env.DEFAULT_PARTNER_MARKUP_PERCENT) ?? 0

/** Customer price for a partner cost, rounded up to the next whole naira. */
const applyMarkup = (cost, percent) => Math.ceil(cost * (1 + (percent || 0) / 100))

/**
 * Price partner rates: drop partners switched off, add each partner's markup (or the default), cheapest first.
 * `partners` is a Map of slug -> { enabled, markup_percent }. Partners not in the map are on and use the default.
 */
const priceRates = (rates, partners, defaultPercent) =>
    (rates || [])
        .map((rate) => {
            const cost = toNumber(rate && rate.amount)
            if (cost === null || cost <= 0) return null
            const slug = slugify(rate.carrier_name)
            const partner = partners.get(slug)
            if (partner && partner.enabled === false) return null
            const custom = partner ? toNumber(partner.markup_percent) : null
            const percent = custom !== null ? custom : defaultPercent
            return { rate, slug, cost, markup_percent: percent, price: applyMarkup(cost, percent) }
        })
        .filter(Boolean)
        .sort((a, b) => a.price - b.price)

/** Load partner settings. Never throws: if the table isn't there yet, quotes keep working with no markup. */
const loadPricing = async (db) => {
    try {
        const rows = await db.partners.findAll()
        const partners = new Map()
        let defaultPercent = envDefaultPercent()
        for (const row of rows) {
            if (row.kind === 'default') {
                const pct = toNumber(row.markup_percent)
                if (pct !== null) defaultPercent = pct
            } else {
                partners.set(row.slug, row)
            }
        }
        return { partners, defaultPercent }
    } catch (error) {
        console.error('Partner pricing unavailable, quoting without markup:', error.message)
        return { partners: new Map(), defaultPercent: envDefaultPercent() }
    }
}

/** Remember carriers that returned rates so they appear on the admin Partners page. Fire-and-forget. */
const recordSeenPartners = async (db, rates, known) => {
    try {
        const now = new Date()
        const seen = new Map()
        for (const rate of rates || []) {
            const slug = slugify(rate.carrier_name)
            if (!seen.has(slug)) seen.set(slug, rate)
        }
        for (const [slug, rate] of seen) {
            if (known.has(slug)) {
                await db.partners.update({ last_seen_at: now, logo_url: rate.carrier_logo || known.get(slug).logo_url }, { where: { slug } })
            } else {
                await db.partners.findOrCreate({
                    where: { slug },
                    defaults: { slug, name: rate.carrier_name || slug, logo_url: rate.carrier_logo || null, last_seen_at: now }
                })
            }
        }
    } catch (error) {
        console.error('Could not record partners:', error.message)
    }
}

module.exports = { DEFAULT_SLUG, slugify, applyMarkup, priceRates, loadPricing, recordSeenPartners }
