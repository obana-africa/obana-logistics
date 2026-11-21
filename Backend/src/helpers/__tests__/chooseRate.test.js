// Run: node --test src/helpers/__tests__/
// No Zoho, no network. This decides what a customer is charged, so the rule
// is pinned here rather than left to be read out of a log.

const test = require('node:test')
const assert = require('node:assert/strict')
const { chooseRate } = require('../currencyRates')

/* The real numbers behind the bug: Zoho's euro rate had not been touched
   since March and sat at NGN 1,207 while the market was about 1,479, so
   every euro lane was quoted roughly a fifth under. */
const STALE_EUR = { rate: 1207, age_days: 243, effective_date: '2026-03-20' }
const TODAY_EUR = 1479.29

test('a stale book rate is refused when there is a fresh one', () => {
    const chosen = chooseRate('EUR', STALE_EUR, TODAY_EUR)
    assert.equal(chosen.rate, TODAY_EUR)
    assert.equal(chosen.from, 'feed')
    assert.match(chosen.warn, /243 days old/)
})

test('a fresh book rate still wins, because the accounts should agree', () => {
    const chosen = chooseRate('EUR', { rate: 1470, age_days: 3, effective_date: '2026-11-18' }, TODAY_EUR)
    assert.equal(chosen.rate, 1470)
    assert.equal(chosen.from, 'books')
    assert.equal(chosen.warn, '')
})

test('a rate exactly at the threshold is not yet stale', () => {
    const chosen = chooseRate('EUR', { rate: 1400, age_days: 30, effective_date: '2026-10-22' }, TODAY_EUR)
    assert.equal(chosen.from, 'books')
})

test('a stale rate is still used when there is no feed — dated money beats none', () => {
    const chosen = chooseRate('EUR', STALE_EUR, 0)
    assert.equal(chosen.rate, 1207)
    assert.equal(chosen.from, 'books')
    assert.match(chosen.warn, /no feed rate/)
})

test('no books at all falls to the feed, as it always did', () => {
    assert.deepEqual(chooseRate('EUR', null, TODAY_EUR), { rate: TODAY_EUR, from: 'feed', warn: '' })
})

test('neither source converts nothing, rather than inventing a rate', () => {
    assert.deepEqual(chooseRate('EUR', null, 0), { rate: 0, from: 'none', warn: '' })
})

test('an undated book rate is treated as current, not as infinitely old', () => {
    const chosen = chooseRate('EUR', { rate: 1470 }, TODAY_EUR)
    assert.equal(chosen.from, 'books')
    assert.equal(chosen.warn, '')
})

test('a zero or unusable book rate is not charged', () => {
    assert.equal(chooseRate('EUR', { rate: 0, age_days: 1 }, TODAY_EUR).from, 'feed')
})
