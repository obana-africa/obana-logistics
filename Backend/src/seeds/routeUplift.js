// Raising every route's price by a flat amount, in one place so the migration
// that applies it and the test that checks it cannot drift apart.

/**
 * A bracket's price covers any parcel inside its weight band — bands are not
 * cumulative, so the uplift goes on each one. That way every shipment on the
 * route costs the same amount more, whatever it weighs.
 */
const NUMERIC = /^-?[0-9]+(\.[0-9]+)?$/;

/** A value that is safely a number, or null. Strings are what JSONB gives back. */
const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v.trim());
    return null;
};

/** Round to kobo, away from float noise (6500 + 3000 must not become 9500.000000000002). */
const kobo = (n) => Number(n.toFixed(2));

/**
 * Price per kg: bracket width, or the max when the width is unusable.
 * The same formula as calculateUnitPrice in the admin form and brackets() in
 * routeSeed, so a route raised here still reads as it would if re-entered.
 */
const unitPriceFor = (price, min, max) => {
    const width = max !== null && min !== null && max - min > 0 ? max - min : max !== null && max > 0 ? max : null;
    if (!width || width <= 0) return null;
    return kobo(price / width);
};

/**
 * Every bracket's price, moved by `amount`.
 *
 * Left exactly as it was: a bracket that is not an object, or whose price is
 * not a number — guessing at those would overwrite a value nobody can read
 * back. A stored unit_price is recalculated, because the Zoho line item and
 * the admin table both take it in preference to working it out (see
 * deriveRouteItemUnitPrice and bracketUnitPrice); left alone it would quote
 * the old price per kg against the new total.
 *
 * Never below zero, so an undo cannot leave a negative price behind.
 *
 * @param {unknown} brackets the row's weight_brackets
 * @param {number} amount NGN to add; negative to take it back off
 * @returns {{ brackets: unknown, changed: boolean }}
 */
const upliftBrackets = (brackets, amount) => {
    if (!Array.isArray(brackets) || brackets.length === 0) return { brackets, changed: false };

    let changed = false;
    const next = brackets.map((bracket) => {
        if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket)) return bracket;

        const price = num(bracket.price);
        if (price === null) return bracket;

        const raised = kobo(Math.max(price + amount, 0));
        if (raised === price) return bracket;

        const updated = { ...bracket, price: raised };

        const storedUnit = num(bracket.unit_price);
        if (storedUnit !== null && storedUnit > 0) {
            const unit = unitPriceFor(raised, num(bracket.min), num(bracket.max));
            if (unit !== null) updated.unit_price = unit;
        }

        changed = true;
        return updated;
    });

    return { brackets: changed ? next : brackets, changed };
};

module.exports = { upliftBrackets, unitPriceFor };
