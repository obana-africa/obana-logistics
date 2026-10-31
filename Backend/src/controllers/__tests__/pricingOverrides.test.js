/* The figures typed in while booking, checked before they reach an invoice. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'routesController.js'), 'utf8');
const from = src.indexOf('const PRICING_LIMITS =');
const to = src.indexOf('const perKiloPrice =');
// eslint-disable-next-line no-eval
const { readPricingOverrides, hasPricingOverrides } = eval(
    `(() => { ${src.slice(from, to)} ; return { readPricingOverrides, hasPricingOverrides }; })()`,
);

test('nothing typed in leaves the lane in charge', () => {
    const o = readPricingOverrides({});
    assert.deepEqual(o, { ratePerKg: null, rateCurrency: null, freight: null, lastMile: null, handlingPercent: null });
    assert.equal(hasPricingOverrides(o), false);
});

test('the Oilclyde job, as agreed', () => {
    const o = readPricingOverrides({
        pricing: { rate_per_kg: 11, rate_currency: 'EUR', last_mile: 585000, handling_percent: 5 },
    });
    assert.equal(o.ratePerKg, 11);
    assert.equal(o.rateCurrency, 'EUR');
    assert.equal(o.lastMile, 585000);
    assert.equal(o.handlingPercent, 5);
    assert.equal(hasPricingOverrides(o), true);
});

test('a rate in naira needs no currency said out loud', () => {
    const o = readPricingOverrides({ pricing: { rate_per_kg: '4500' } });
    assert.equal(o.ratePerKg, 4500);
    assert.equal(o.rateCurrency, 'NGN');
});

test('thousands separators are read, not rejected', () => {
    assert.equal(readPricingOverrides({ pricing: { last_mile: '585,000' } }).lastMile, 585000);
});

test('a figure that would misprice the job is refused, and the lane keeps its own', () => {
    for (const bad of [0, -11, 'eleven', '', null, undefined, 1e9]) {
        assert.equal(readPricingOverrides({ pricing: { rate_per_kg: bad } }).ratePerKg, null, String(bad));
    }
});

test('a rate with a currency that is not one is refused rather than guessed at', () => {
    const o = readPricingOverrides({ pricing: { rate_per_kg: 11, rate_currency: 'EUROS' } });
    assert.equal(o.ratePerKg, null);
    assert.equal(o.rateCurrency, null);
});

test('handling of zero means charge nothing, which is different from saying nothing', () => {
    assert.equal(readPricingOverrides({ pricing: { handling_percent: 0 } }).handlingPercent, 0);
    assert.equal(readPricingOverrides({ pricing: {} }).handlingPercent, null);
});

test('a handling percent nobody meant is refused', () => {
    for (const bad of [101, -5, 900, 'five']) {
        assert.equal(readPricingOverrides({ pricing: { handling_percent: bad } }).handlingPercent, null, String(bad));
    }
});

test('one figure can be given without the others', () => {
    const o = readPricingOverrides({ pricing: { handling_percent: 5 } });
    assert.equal(o.handlingPercent, 5);
    assert.equal(o.ratePerKg, null);
    assert.equal(o.lastMile, null);
});

/* ── priced as a job, rather than by the kilo ───────────────────────────── */

test('a flat freight amount is accepted on its own', () => {
    const o = readPricingOverrides({ pricing: { freight: 3711787, last_mile: 585000 } });
    assert.equal(o.freight, 3711787);
    assert.equal(o.ratePerKg, null);
    assert.equal(o.lastMile, 585000);
    assert.equal(hasPricingOverrides(o), true);
});

test('a rate wins over an amount when both are given', () => {
    const o = readPricingOverrides({ pricing: { rate_per_kg: 10.09, rate_currency: 'EUR', freight: 999999 } });
    assert.equal(o.ratePerKg, 10.09);
    assert.equal(o.freight, null);
});

test('a rate refused for a bad currency does not let the amount through by accident', () => {
    const o = readPricingOverrides({ pricing: { rate_per_kg: 11, rate_currency: 'EUROS', freight: 3711787 } });
    assert.equal(o.ratePerKg, null);
    assert.equal(o.freight, 3711787);
});

test('the rate agreed for Oilclyde, to the kobo', () => {
    assert.equal(readPricingOverrides({ pricing: { rate_per_kg: '10.09', rate_currency: 'eur' } }).ratePerKg, 10.09);
    assert.equal(readPricingOverrides({ pricing: { rate_per_kg: '10.09', rate_currency: 'eur' } }).rateCurrency, 'EUR');
});
