/**
 * Crossing two of Zoho's rates to get one this codebase can use.
 *
 * Zoho Books holds one rate per currency, all against the org's BASE
 * currency, which for this org is USD. The column in Zoho reads "Exchange
 * Rate (in USD)" and the figure is the value of ONE UNIT of that currency in
 * USD: NGN sits at 0.000714, which is to say ₦1 is $0.000714, which is to say
 * $1 is about ₦1,400.
 *
 * Everything priced here is in naira, so what a caller wants is naira per
 * euro — a pair Zoho does not hold, because the books are kept in dollars.
 * It is one division away:
 *
 *     naira per EUR  =  (USD per EUR)  ÷  (USD per NGN)
 *
 * Done from the merchant's OWN books rather than a public feed, for the same
 * reason the dollar rate already is: the shipping charge lands in those books,
 * and a document quoting a different rate disagrees with the customer's own
 * invoice. Of the two numbers, the one in the accounts has to be right.
 *
 * No rate is invented here. A currency Zoho has no rate for returns null and
 * the caller falls back to the daily feed, exactly as before.
 */

/** A positive, finite number, or 0. Zoho sends these as strings. */
const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Naira per one unit of `code`, from two base-quoted rates.
 *
 * `usdPerUnit` is the value of one unit of the wanted currency in the base,
 * `usdPerNaira` the value of one naira in the base. Both come from the same
 * Zoho table, so the base cancels and the result is independent of which
 * currency the org happens to keep its books in.
 */
function nairaPerUnit(usdPerUnit, usdPerNaira) {
    const unit = num(usdPerUnit)
    const naira = num(usdPerNaira)
    if (!unit || !naira) return 0
    return unit / naira
}

/**
 * The rate in force on a day: the most recent one not after it.
 *
 * Zoho keeps a dated history and the newest row is not necessarily the one
 * that applied — a rate can be entered for a future date. Falls back to the
 * oldest when every row is in the future, so a lane still prices.
 */
function rateInForce(list, onDate) {
    const rows = Array.isArray(list) ? list : []
    if (!rows.length) return null
    const day = String(onDate || new Date().toISOString().slice(0, 10))
    const inForce = rows
        .filter((r) => String(r.effective_date || '') <= day)
        .sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0]
    if (inForce) return { row: inForce, stale: false }
    const oldest = [...rows].sort((a, b) =>
        String(a.effective_date).localeCompare(String(b.effective_date))
    )[0]
    return { row: oldest, stale: true }
}

/** How many days old a rate is — for the warning, never for the arithmetic. */
function ageInDays(effectiveDate, today = new Date()) {
    if (!effectiveDate) return null
    const then = Date.parse(`${String(effectiveDate).slice(0, 10)}T00:00:00Z`)
    if (!Number.isFinite(then)) return null
    const now = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`)
    return Math.max(0, Math.round((now - then) / 86400000))
}

module.exports = { nairaPerUnit, rateInForce, ageInDays }
