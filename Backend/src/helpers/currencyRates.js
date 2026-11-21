const { currencyForCountry, ngnRate } = require('./fx')
const { nairaPerUsd } = require('./usdRate')
const { nairaPerCurrency } = require('./zohoInventory')

/** Past this, a rate from the books is too old to charge anybody at. */
const STALE_AFTER_DAYS = 30

/**
 * Which of the two rates to charge at, and why.
 *
 * Pulled out of nairaPer so the rule can be read and tested on its own: it
 * decides money, and it had been getting this wrong in production for months
 * with only a log line to say so.
 *
 * `books` is { rate, age_days, effective_date } or null; `feed` is a number
 * or 0. Returns { rate, from, warn } — `warn` is the sentence to log, or ''.
 */
const chooseRate = (code, books, feed, staleAfterDays = STALE_AFTER_DAYS) => {
    const bookRate = Number(books?.rate) || 0
    const age = Number(books?.age_days)
    const fresh = feed > 0

    if (!(bookRate > 0)) return { rate: fresh ? feed : 0, from: fresh ? 'feed' : 'none', warn: '' }

    /* An unknown age is treated as current. The books are the default source
       and a missing date is not evidence against them. */
    const stale = Number.isFinite(age) && age > staleAfterDays
    if (!stale) return { rate: bookRate, from: 'books', warn: '' }

    if (fresh) {
        return {
            rate: feed,
            from: 'feed',
            warn: `[fx] Zoho's ${code}→NGN rate is ${age} days old (${books.effective_date}) — quoting at today's ${feed.toFixed(2)} instead. Update it in Zoho → Currencies.`,
        }
    }
    /* Dated money still beats no money: without a feed there is nothing to
       convert with, and naira alone is the thing nobody can read. */
    return {
        rate: bookRate,
        from: 'books',
        warn: `[fx] Zoho's ${code}→NGN rate is ${age} days old (${books.effective_date}) and no feed rate is available — update it in Zoho → Currencies`,
    }
}

/**
 * What one unit of a currency is worth in naira.
 *
 * Every price Obana holds is in naira — the route table, the fee split, the
 * figure written back to Zoho. A document that quotes a shipper in their own
 * currency is therefore always a conversion, and this is the one place that
 * conversion is worked out.
 *
 * Zoho first, for dollars. The shipping charge lands in Zoho's books, so a
 * document quoting a different dollar rate than the books use would disagree
 * with the customer's own invoice, and of the two numbers the one in the
 * accounts has to be right.
 *
 * For everything else there is no Zoho rate to agree with — the books are not
 * kept in euros — so the daily feed is used. It is the same feed the public
 * quote page has always priced in, which means a shipper who was quoted in
 * euros and then invoiced in euros sees one number, not two.
 *
 * Zero when no rate can be had. Callers show naira alone rather than invent
 * one; a missing conversion is a smaller problem than a wrong one.
 */
const nairaPer = async (currency) => {
    const code = String(currency || '').toUpperCase()
    if (!code || code === 'NGN') return 1

    if (code === 'USD') {
        const zoho = await nairaPerUsd()
        if (zoho > 0) return zoho
    }

    /* The books first, for every currency — not only the dollar.
     *
     * This used to try Zoho for USD alone, on the reasoning that "the books
     * are not kept in euros". True, and beside the point: the org's base is
     * the dollar, so a euro rate is two of Zoho's own rates crossed through
     * it. The pair does not have to exist for the answer to come from the
     * merchant's accounts.
     *
     * It matters for the same reason the dollar did. A lane priced in euros
     * is invoiced in euros and lands in those books; converting at a public
     * feed's rate while the accounts use another means the two disagree, and
     * of the two the accounts are the one that has to be right.
     *
     * Falls through to the feed when Zoho holds no rate for the currency —
     * several rows on that screen are blank — so nothing that worked before
     * stops working. */
    const fromBooks = await nairaPerCurrency(code).catch((error) => {
        console.warn(`[fx] no Zoho rate for ${code} (${error.message}) — trying the daily feed`)
        return null
    })
    /* fx quotes the other way round — units of `code` for one naira — so a
       rate near 0.00058 is inverted to the ~1,700 naira a dollar that every
       caller here expects. Fetched before the decision below, because a
       stale book rate is only worth refusing when there is something fresher
       to refuse it for. */
    const fx = await ngnRate(code).catch(() => null)
    const perNaira = Number(fx?.rate) || 0
    const fromFeed = perNaira > 0 ? 1 / perNaira : 0

    const chosen = chooseRate(code, fromBooks, fromFeed)
    if (chosen.warn) console.warn(chosen.warn)
    return chosen.rate
}

/**
 * Which currency a shipment is quoted in, and which it converts to.
 *
 * The base is the shipper's: the local currency where the goods are picked
 * up, because that is the money the person paying for this thinks in and the
 * rate they will compare against other forwarders. The second is the
 * receiver's, so the other end can see what will be charged at theirs.
 *
 * A shipment that begins and ends in the same currency has one, not two.
 */
const currenciesFor = (fromCode, toCode) => {
    const base = currencyForCountry(fromCode) || 'NGN'
    const other = currencyForCountry(toCode) || 'NGN'
    return { base, other: other === base ? null : other }
}

/**
 * The currency to quote a shipper in, and what one unit of it costs in naira.
 *
 * Their own money first. If no rate can be had for it — a feed outage, or a
 * currency nobody publishes — the dollar is tried before giving up, because a
 * figure in dollars is one the sender can still convert, and naira alone is
 * the thing they cannot read at all. Only when the dollar fails too does the
 * document fall back to naira, which is at least always correct.
 */
const quoteCurrency = async (fromCode, toCode) => {
    const { base } = currenciesFor(fromCode, toCode)
    if (!base || base === 'NGN') return { code: 'NGN', nairaPerUnit: 0 }

    const own = await nairaPer(base)
    if (own > 0) return { code: base, nairaPerUnit: own }

    if (base !== 'USD') {
        const dollars = await nairaPer('USD')
        if (dollars > 0) {
            console.warn(`[currency] no rate for ${base}; quoting the shipper in USD instead`)
            return { code: 'USD', nairaPerUnit: dollars }
        }
    }
    return { code: 'NGN', nairaPerUnit: 0 }
}

module.exports = { nairaPer, currenciesFor, currencyForCountry, quoteCurrency, chooseRate, STALE_AFTER_DAYS }
