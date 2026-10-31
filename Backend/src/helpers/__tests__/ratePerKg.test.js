const test = require('node:test');
const assert = require('node:assert');
const { buildShipmentSummary } = require('../shipmentSummary');

const job = (legs, fee, base, charge) => ({
    shipment_reference: 'OBN-T',
    currency: 'NGN',
    total_weight: 245,
    total_items: 1,
    shipping_fee: fee,
    transport_mode: 'air',
    service_level: 'standard',
    metadata: { fee_breakdown: { base, service_charge: charge, service_charge_percent: 10, legs } },
});

const build = (shipment) =>
    buildShipmentSummary(shipment, {
        pickup: { city: 'Milan', country: 'Italy', country_code: 'IT' },
        delivery: { city: 'Port Harcourt', country: 'Nigeria', country_code: 'NG' },
        items: [],
        countryCodeOf: (a) => a?.country_code || null,
        deliveryTimeRange: async () => null,
    });

const twoLeg = () =>
    job(
        [
            { kind: 'international', from: 'Italy', to: 'Nigeria', base_price: 3711787 },
            { kind: 'local', from: 'Lagos', to: 'Port Harcourt', base_price: 1028626 },
        ],
        5214455,
        4740413,
        474042,
    );

test('the rate per kilo is the crossing, not the crossing plus the inland leg', async () => {
    const s = await build(twoLeg());
    /* 3,711,787 / 245. The inland leg is a job, not a rate, so dividing it by
       the weight invents a per-kilo figure nobody quoted — and reading that
       figure as the rate is what made EUR 10.09 show as EUR 13. */
    assert.equal(Math.round(s.ratePerKg.amount), 15150);
});

test('a job with one leg is unchanged', async () => {
    const s = await build(job(null, 2200000, 2000000, 200000));
    assert.equal(Math.round(s.ratePerKg.amount), Math.round(2000000 / 245));
});

test('the breakdown still adds up to the total', async () => {
    const s = await build(twoLeg());
    const line = (k) => s.charges.find((c) => c.key === k)?.amount ?? 0;
    assert.equal(line('leg_international') + line('leg_local') + line('service_charge'), line('total'));
});
