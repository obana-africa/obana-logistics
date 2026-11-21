// Run: node src/helpers/currencyCross.test.js
// No database, no Zoho. This decides what a European customer is charged in
// naira, so the figures below are the real ones off the org's own Currencies
// screen, not invented examples.

const assert = require('assert');
const { nairaPerUnit, rateInForce, ageInDays } = require('./currencyCross');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

/* Straight off books.zoho.com → Settings → Currencies, base USD.
   The column is the value of ONE UNIT in USD. */
const USD_PER_NGN = 0.000714; // as of 23 Jul 2026
const USD_PER_EUR = 0.862069; // as of 24 Mar 2026

/* ── The arithmetic ─────────────────────────────────────────────────────── */

it('a dollar is what the books say a dollar is', () => {
    // 1 / 0.000714 = 1400.56, and the org's own screen reads ₦1,400 to the
    // dollar. If this number ever moves, the books moved.
    assert.ok(Math.abs(nairaPerUnit(1, USD_PER_NGN) - 1400.56) < 0.01);
});

it('a euro is crossed through the base, not looked up', () => {
    // Zoho holds no NGN↔EUR pair; the base cancels: (USD/EUR) ÷ (USD/NGN).
    assert.ok(Math.abs(nairaPerUnit(USD_PER_EUR, USD_PER_NGN) - 1207.38) < 0.01);
});

it('the base cancels, so the org could keep its books in anything', () => {
    // Same two currencies expressed against a different base give the same
    // cross rate — which is the whole point of dividing rather than looking up.
    const inGbp = nairaPerUnit(USD_PER_EUR * 0.79, USD_PER_NGN * 0.79);
    assert.ok(Math.abs(inGbp - nairaPerUnit(USD_PER_EUR, USD_PER_NGN)) < 0.0001);
});

/* ── Refusing, rather than guessing ─────────────────────────────────────── */

it('a currency Zoho has no rate for returns nothing', () => {
    // GBP, INR, RWF, TZS, UGX, XAF, XOF and ZAR are all blank on that screen.
    assert.strictEqual(nairaPerUnit(0, USD_PER_NGN), 0);
    assert.strictEqual(nairaPerUnit(null, USD_PER_NGN), 0);
    assert.strictEqual(nairaPerUnit(undefined, USD_PER_NGN), 0);
    assert.strictEqual(nairaPerUnit('', USD_PER_NGN), 0);
});

it('no naira rate is also nothing — never a division by zero', () => {
    assert.strictEqual(nairaPerUnit(USD_PER_EUR, 0), 0);
    assert.strictEqual(nairaPerUnit(USD_PER_EUR, null), 0);
});

it('a negative or unparseable rate is not a rate', () => {
    assert.strictEqual(nairaPerUnit(-1, USD_PER_NGN), 0);
    assert.strictEqual(nairaPerUnit('abc', USD_PER_NGN), 0);
});

/* ── Which dated row applies ────────────────────────────────────────────── */

const rows = [
    { effective_date: '2026-03-24', rate: '0.862069' },
    { effective_date: '2026-07-23', rate: '0.880000' },
    { effective_date: '2027-01-01', rate: '0.900000' }, // entered ahead of time
];

it('the rate in force is the newest one not in the future', () => {
    const { row, stale } = rateInForce(rows, '2026-11-21');
    assert.strictEqual(row.effective_date, '2026-07-23');
    assert.strictEqual(stale, false);
});

it('a rate entered for a future date does not apply yet', () => {
    assert.strictEqual(rateInForce(rows, '2026-08-01').row.effective_date, '2026-07-23');
});

it('on the day a rate takes effect, it applies', () => {
    assert.strictEqual(rateInForce(rows, '2026-07-23').row.effective_date, '2026-07-23');
});

it('all rates in the future still prices, and says it is reaching', () => {
    const { row, stale } = rateInForce(rows, '2026-01-01');
    assert.strictEqual(row.effective_date, '2026-03-24');
    assert.strictEqual(stale, true);
});

it('no rows at all is nothing to apply', () => {
    assert.strictEqual(rateInForce([], '2026-11-21'), null);
    assert.strictEqual(rateInForce(null, '2026-11-21'), null);
});

/* ── How old the number is ──────────────────────────────────────────────── */

it('age is counted in whole days', () => {
    assert.strictEqual(ageInDays('2026-11-21', new Date('2026-11-21T10:00:00Z')), 0);
    assert.strictEqual(ageInDays('2026-11-14', new Date('2026-11-21T10:00:00Z')), 7);
});

/* The reason age matters at all: crossing two rates of different vintages
   gives a cross rate that was never true. The org's EUR row is dated 24 Mar
   and its NGN row 23 Jul — four months apart — which is why ₦1,207/EUR comes
   out below ₦1,400/USD and reads as a euro worth less than a dollar. */
it('a four-month-old rate is reported as four months old', () => {
    assert.strictEqual(ageInDays('2026-03-24', new Date('2026-07-23T00:00:00Z')), 121);
});

it('a missing or unreadable date has no age rather than a wrong one', () => {
    assert.strictEqual(ageInDays(null), null);
    assert.strictEqual(ageInDays('not-a-date'), null);
});

let failed = 0;
for (const [name, fn] of cases) {
    try { fn(); console.log(`  ok  ${name}`); }
    catch (e) { failed++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
console.log(failed ? `\n${failed} failing` : `\n${cases.length} passing`);
process.exit(failed ? 1 : 0);
