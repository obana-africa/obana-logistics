const { currencyForCountry, ngnRate } = require('./fx')
const { nairaPerUsd } = require('./usdRate')

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

    /* fx quotes the other way round — units of `code` for one naira — so a
       rate near 0.00058 is inverted to the ~1,700 naira a dollar that every
       caller here expects. */
    const fx = await ngnRate(code).catch(() => null)
    const perNaira = Number(fx?.rate) || 0
    return perNaira > 0 ? 1 / perNaira : 0
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

module.exports = { nairaPer, currenciesFor, currencyForCountry }
