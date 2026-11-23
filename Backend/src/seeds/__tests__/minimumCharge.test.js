// Run: node --test src/seeds/__tests__/
// The floors that stop a long run being sold for a short run's price.

const test = require('node:test')
const assert = require('node:assert/strict')
const { atLeastMinimum, atLeastCityMinimum, tierFor, MINIMUM_BASE } = require('../pricing2026')
const { zoneOf, stateKey } = require('../repriceNigeria')

const tierBetween = (from, to) =>
    tierFor({
        sameState: stateKey(from) === stateKey(to),
        originZone: zoneOf(stateKey(from)),
        destinationZone: zoneOf(stateKey(to)),
    })

test('a long run is not sold at a short run price', () => {
    /* A 0.2 kg parcel on a lane whose lightest bracket is cheap used to quote
       whatever that bracket said, however far it went. */
    const tier = tierBetween('Abia', 'Lagos')
    assert.notEqual(tier, null)
    assert.ok(atLeastMinimum(900, 'Standard', tier) >= MINIMUM_BASE[tier].Standard)
})

test('the further it goes, the higher the floor', () => {
    const near = tierBetween('Lagos', 'Oyo')
    const far = tierBetween('Lagos', 'Kano')
    assert.ok(
        MINIMUM_BASE[far].Standard > MINIMUM_BASE[near].Standard,
        'a longer journey must not floor lower than a shorter one',
    )
})

test('a price already above the floor is left alone', () => {
    const tier = tierBetween('Lagos', 'Rivers')
    assert.equal(atLeastMinimum(250000, 'Standard', tier), 250000)
})

test('the service level decides which floor applies', () => {
    const tier = tierBetween('Lagos', 'Rivers')
    assert.ok(atLeastMinimum(0, 'Express', tier) > atLeastMinimum(0, 'Economy', tier))
})

test('within one state the journey is "same", not a zone gap', () => {
    assert.equal(tierBetween('Lagos', 'Lagos'), 'same')
})

test('an unmappable state has no tier, so nothing is floored', () => {
    assert.equal(tierBetween('Atlantis', 'Lagos'), null)
})

test('crossing Lagos never costs more than leaving it', () => {
    /* The intra-state bands must stay under the cheapest interstate floor,
       or a sixty-kilometre run inside Lagos would price above a
       three-hundred-kilometre run out of it. */
    const leaving = MINIMUM_BASE[0].Standard
    assert.ok(atLeastCityMinimum(0, 'Standard', 'metro') < leaving)
})
