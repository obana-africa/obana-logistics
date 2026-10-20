// Run: node src/seeds/routeUplift.test.js
// No database and no test runner — the transformation is a pure function, and
// this is the part of the repricing migration that can actually be wrong.

const assert = require('assert');
const { upliftBrackets } = require('./routeUplift');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

/* ── the ordinary case: one band, as every seeded route has ─────────── */

it('adds the amount to a seeded route', () => {
    const before = [{ min: 0, max: 10, price: 6500, eta: '1-2 days', unit_price: 650 }];
    const { brackets, changed } = upliftBrackets(before, 3000);
    assert.strictEqual(changed, true);
    assert.strictEqual(brackets[0].price, 9500);
    assert.strictEqual(brackets[0].unit_price, 950, 'price per kg must follow the total');
    assert.strictEqual(brackets[0].eta, '1-2 days', 'everything else is left alone');
});

it('does not mutate the row it was given', () => {
    const before = [{ min: 0, max: 10, price: 6500, unit_price: 650 }];
    upliftBrackets(before, 3000);
    assert.strictEqual(before[0].price, 6500);
});

/* ── several bands: the charge, not a step, so each one moves ───────── */

it('moves every band, because a band is a whole price', () => {
    const before = [
        { min: 0, max: 10, price: 15000, unit_price: 1500 },
        { min: 10, max: 30, price: 28000, unit_price: 1400 },
    ];
    const { brackets } = upliftBrackets(before, 3000);
    assert.deepStrictEqual(
        brackets.map((b) => [b.price, b.unit_price]),
        [[18000, 1800], [31000, 1550]],
    );
});

/* ── sea freight, where the band is 0–100 ───────────────────────────── */

it('works out price per kg from the band width, not the max alone', () => {
    const before = [{ min: 20, max: 100, price: 160000, unit_price: 2000 }];
    const { brackets } = upliftBrackets(before, 3000);
    assert.strictEqual(brackets[0].price, 163000);
    assert.strictEqual(brackets[0].unit_price, 2037.5, '163000 / 80');
});

/* ── what JSONB actually hands back ─────────────────────────────────── */

it('accepts numbers stored as strings', () => {
    const { brackets } = upliftBrackets([{ min: '0', max: '10', price: '6500', unit_price: '650' }], 3000);
    assert.strictEqual(brackets[0].price, 9500);
    assert.strictEqual(brackets[0].unit_price, 950);
});

it('leaves a price it cannot read exactly as it found it', () => {
    const before = [{ min: 0, max: 10, price: 'on request' }];
    const { brackets, changed } = upliftBrackets(before, 3000);
    assert.strictEqual(changed, false);
    assert.strictEqual(brackets[0].price, 'on request');
});

it('leaves a bracket with no unit_price without inventing one', () => {
    const { brackets } = upliftBrackets([{ min: 0, max: 10, price: 6500 }], 3000);
    assert.strictEqual(brackets[0].price, 9500);
    assert.strictEqual('unit_price' in brackets[0], false, 'the readers derive it when it is absent');
});

it('does not divide by a band of zero width', () => {
    const { brackets } = upliftBrackets([{ min: 0, max: 0, price: 5000, unit_price: 100 }], 3000);
    assert.strictEqual(brackets[0].price, 8000);
    assert.strictEqual(brackets[0].unit_price, 100, 'kept rather than set to Infinity');
});

/* ── nothing to do ──────────────────────────────────────────────────── */

for (const [name, value] of [['null', null], ['undefined', undefined], ['empty', []], ['not an array', { price: 1 }]]) {
    it(`says nothing changed for weight_brackets that are ${name}`, () => {
        const { changed } = upliftBrackets(value, 3000);
        assert.strictEqual(changed, false);
    });
}

it('steps over a bracket that is not an object', () => {
    const { brackets } = upliftBrackets([null, 'x', { min: 0, max: 10, price: 1000 }], 3000);
    assert.strictEqual(brackets[0], null);
    assert.strictEqual(brackets[1], 'x');
    assert.strictEqual(brackets[2].price, 4000);
});

/* ── the undo ───────────────────────────────────────────────────────── */

it('puts a route back where it started', () => {
    const before = [{ min: 0, max: 10, price: 6500, unit_price: 650 }];
    const { brackets: up } = upliftBrackets(before, 3000);
    const { brackets: down } = upliftBrackets(up, -3000);
    assert.deepStrictEqual(down, before);
});

it('floors at zero rather than going negative', () => {
    const { brackets } = upliftBrackets([{ min: 0, max: 10, price: 1200, unit_price: 120 }], -3000);
    assert.strictEqual(brackets[0].price, 0);
});

/* ── float noise ────────────────────────────────────────────────────── */

it('does not leave float dust in a price', () => {
    const { brackets } = upliftBrackets([{ min: 0, max: 3, price: 10.1, unit_price: 3.37 }], 3000);
    assert.strictEqual(brackets[0].price, 3010.1);
    assert.strictEqual(brackets[0].unit_price, 1003.37);
});

let failed = 0;
for (const [name, fn] of cases) {
    try {
        fn();
        console.log(`  ok   ${name}`);
    } catch (error) {
        failed += 1;
        console.log(`  FAIL ${name}\n       ${error.message}`);
    }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
