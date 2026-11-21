// Run: node --test src/controllers/__tests__/
// What a draft is called is the only thing separating two of them in a list,
// so the cases that used to collide are pinned here.

const test = require('node:test')
const assert = require('node:assert/strict')
const { labelFor } = require('../draftLabel')

const draft = (over = {}) => ({
    pickup_address: { city: 'Lagos' },
    delivery_address: { city: 'Abuja', name: '' },
    items: [],
    ...over,
})

test('two bookings down the same lane no longer read the same', () => {
    const a = labelFor(draft({ delivery_address: { city: 'Abuja', name: 'Bob Onyeukwu' }, items: [{ weight: '245', quantity: '1' }] }))
    const b = labelFor(draft({ delivery_address: { city: 'Abuja', name: 'Ada Eze' }, items: [{ weight: '12', quantity: '1' }] }))
    assert.notEqual(a, b)
    assert.equal(a, 'Lagos → Abuja · Bob Onyeukwu · 245 kg')
    assert.equal(b, 'Lagos → Abuja · Ada Eze · 12 kg')
})

test('same lane and same person still differ by what is being sent', () => {
    const who = { city: 'Abuja', name: 'Bob Onyeukwu' }
    assert.notEqual(
        labelFor(draft({ delivery_address: who, items: [{ weight: '245', quantity: '1' }] })),
        labelFor(draft({ delivery_address: who, items: [{ weight: '30', quantity: '1' }] })),
    )
})

test('quantity counts towards the weight, as the shipment does', () => {
    assert.equal(labelFor(draft({ items: [{ weight: '10', quantity: '3' }] })), 'Lagos → Abuja · 30 kg')
})

test('several lines add up', () => {
    assert.equal(
        labelFor(draft({ items: [{ weight: '10', quantity: '1' }, { weight: '2.5', quantity: '2' }] })),
        'Lagos → Abuja · 15 kg',
    )
})

test('a name somebody typed is used as it was typed', () => {
    assert.equal(labelFor(draft(), 'Christmas stock'), 'Christmas stock')
})

test('a half-filled form still gets a name', () => {
    assert.equal(labelFor({}), 'Untitled draft')
    assert.equal(labelFor(draft({ delivery_address: {} , items: [] })), 'Lagos')
})

test('a weight nobody has entered is not shown as zero', () => {
    assert.equal(labelFor(draft({ items: [{ weight: '', quantity: '1' }] })), 'Lagos → Abuja')
})

test('an unreadable weight is left out rather than printed as NaN', () => {
    assert.equal(labelFor(draft({ items: [{ weight: 'heavy', quantity: '1' }] })), 'Lagos → Abuja')
})
