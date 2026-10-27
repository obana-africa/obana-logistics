const zoho = require('./zohoInventory')

/**
 * How many naira to one dollar, as Zoho holds it.
 *
 * Zoho's rate and not a public feed, because the shipping charge is written
 * back into Zoho's books: a document or a message quoting a different rate
 * would disagree with the customer's own invoice, and of the two numbers the
 * one in the accounts is the one that has to be right. The team already sets
 * it in Zoho under Currencies, so there is nothing new to maintain.
 *
 * Shared, so that the quote the customer is shown, the summary they are sent
 * and the WhatsApp message they receive all state the same figure. Three
 * places each fetching their own would drift apart within the hour.
 *
 * getNairaRate refuses rather than guesses when Zoho has no rate for the day —
 * correct for writing money, wrong for drawing a document. So a failure here
 * returns 0 and every caller is expected to drop the dollars and show the
 * naira alone. A missing conversion is a smaller problem than a wrong one, and
 * much smaller than no document at all.
 */
const TTL_MS = 60 * 60 * 1000
let cached = { at: 0, rate: 0 }

const nairaPerUsd = async () => {
    if (cached.rate > 0 && Date.now() - cached.at < TTL_MS) return cached.rate
    try {
        const { rate } = await zoho.getNairaRate()
        if (rate > 0) cached = { at: Date.now(), rate }
    } catch (error) {
        /* A stale rate beats no rate, and `at` is left alone so the next caller
           tries again rather than waiting out the cache. */
        console.warn(`[usd] no Zoho NGN rate (${error.message}) — figures will be naira only`)
    }
    return cached.rate
}

/** "$360.66", or '' when there is no rate or the figure is not in naira. */
const inUsd = (amount, currency, perUsd) => {
    if (!(perUsd > 0) || String(currency || 'NGN').toUpperCase() !== 'NGN') return ''
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return ''
    return `$${(value / perUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

module.exports = { nairaPerUsd, inUsd }
