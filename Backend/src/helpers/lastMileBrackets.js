/**
 * The inland leg priced by weight.
 *
 * A lane that runs a 35 kg parcel and a 245 kg pallet to the same door is not
 * doing the same job twice, and `last_mile_flat` — one amount for any weight
 * — could not say so. The only alternative was `last_mile_per_kg`, which says
 * the opposite: that a job quoted as a job scales linearly, which is how an
 * agreed NGN 585,000 had to be entered as 2,387.755 per kilo and came back as
 * 585,001.
 *
 * Brackets say the thing that is actually true: between these two weights, it
 * costs this. The same shape, the same edges and the same overflow rule as
 * the freight brackets the route already carries, so there is one idea of
 * what a weight bracket is rather than two.
 *
 * A lane without them is untouched — `price` returns null and every existing
 * lane goes on being priced exactly as it was.
 */

const num = (v) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(/,/g, ''))
    return Number.isFinite(n) ? n : NaN
}

/* Rows are written as min/max by the route form, and some older ones carry
   min_weight/max_weight. Both are read so a lane does not stop pricing
   because of which spelling it happens to hold. */
const minOf = (b) => {
    const a = num(b?.min)
    return Number.isFinite(a) ? a : num(b?.min_weight)
}
const maxOf = (b) => {
    const a = num(b?.max)
    return Number.isFinite(a) ? a : num(b?.max_weight)
}

/**
 * The bracket covering `weight`.
 *
 * Lower bound inclusive and upper inclusive, so 0–35 and 35–245 share their
 * edge without both claiming 35 — the first one sorted wins it, which is the
 * lighter. Anything above the heaviest bracket is returned on the heaviest,
 * and priced up from it by priceFromBrackets, because a shipment heavier
 * than the table anticipated still has to be delivered.
 */
const bracketFor = (brackets, weight) => {
    const rows = (Array.isArray(brackets) ? brackets : [])
        .filter((b) => Number.isFinite(minOf(b)) && num(b?.price) > 0)
        .sort((a, b) => minOf(a) - minOf(b))
    if (!rows.length) return null
    const w = num(weight)
    if (!Number.isFinite(w) || w < 0) return null
    const hit = rows.find((b) => {
        const max = maxOf(b)
        return w >= minOf(b) && (!Number.isFinite(max) || w <= max)
    })
    return hit ?? rows[rows.length - 1]
}

/**
 * { price, eta } for this weight, or null when the lane has no brackets.
 *
 * Past the heaviest bracket the price is carried up rather than held flat.
 * Holding it flat meant a table ending at 25 kg charged a 45 kg delivery the
 * 25 kg price — the lane was priced "up to its maximum" and then stopped
 * reading the weight at all, which is both wrong money and the reason a
 * table had to be extended every time somebody sent something heavier.
 *
 * Carried up at the heaviest bracket's own rate per kilo, which is the same
 * arithmetic priceTemplate uses for freight that overruns its table — one
 * idea of what to do past the end of a table, not two.
 */
const priceFromBrackets = (brackets, weight) => {
    const hit = bracketFor(brackets, weight)
    if (!hit) return null
    const price = num(hit.price)
    if (!(price > 0)) return null

    const w = num(weight)
    const max = maxOf(hit)
    const over = Number.isFinite(max) && max > 0 && w > max
    const total = over ? price + ((w - max) * price) / max : price

    return {
        price: Math.ceil(total),
        eta: hit.eta ? String(hit.eta) : null,
        /* So a quote can say the weight was outside the table. */
        is_overweight: over || undefined,
    }
}

module.exports = { bracketFor, priceFromBrackets }
