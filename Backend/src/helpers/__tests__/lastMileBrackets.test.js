// Run: node src/helpers/__tests__/lastMileBrackets.test.js
// No database, no network. These pin the rule the quote engine follows for
// the inland leg, including that a lane without brackets is left alone.

const test = require('node:test')
const assert = require('node:assert/strict')
const { priceFromBrackets } = require('../lastMileBrackets')

const LAGOS_PH = [
    { min: 0, max: 35, price: 120000, eta: '2-3 days' },
    { min: 35, max: 245, price: 585000, eta: '3-5 days' },
]

test('a lane with no brackets is priced exactly as it was', () => {
    assert.equal(priceFromBrackets(null, 100), null)
    assert.equal(priceFromBrackets([], 100), null)
    assert.equal(priceFromBrackets(undefined, 100), null)
})

test('the bracket covering the weight is the one charged', () => {
    assert.equal(priceFromBrackets(LAGOS_PH, 30).price, 120000)
    assert.equal(priceFromBrackets(LAGOS_PH, 200).price, 585000)
})

test('brackets sharing an edge do not both claim it', () => {
    assert.equal(priceFromBrackets(LAGOS_PH, 35).price, 120000)
})

test('past the heaviest bracket the leg is still delivered, and still priced', () => {
    assert.equal(priceFromBrackets(LAGOS_PH, 900).price, 585000)
})

test('the delivery time comes along with the price', () => {
    assert.equal(priceFromBrackets(LAGOS_PH, 30).eta, '2-3 days')
    assert.equal(priceFromBrackets([{ min: 0, max: 50, price: 1000 }], 10).eta, null)
})

test('a row with no usable price is not charged', () => {
    assert.equal(priceFromBrackets([{ min: 0, max: 50, price: 0 }], 10), null)
    assert.equal(priceFromBrackets([{ min: 0, max: 50, price: 'free' }], 10), null)
})

test('the older min_weight/max_weight spelling still prices', () => {
    assert.equal(priceFromBrackets([{ min_weight: 0, max_weight: 245, price: 300000 }], 100).price, 300000)
})

test('money is rounded up to the naira, never down', () => {
    assert.equal(priceFromBrackets([{ min: 0, max: 50, price: 1000.2 }], 10).price, 1001)
})

test('a nonsense weight prices nothing rather than guessing', () => {
    assert.equal(priceFromBrackets(LAGOS_PH, -5), null)
    assert.equal(priceFromBrackets(LAGOS_PH, 'heavy'), null)
})
