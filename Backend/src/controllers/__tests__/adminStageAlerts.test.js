/* Obana hears about every stage, not the three that had a customer template.
 *
 * A shipment moves through nine statuses. Three of them had an approved
 * WhatsApp template — created, in transit, delivered — and notifyShipmentEvent
 * returned at its first line for anything else. So a parcel that was
 * cancelled, returned, or that outright FAILED told nobody here anything: the
 * three stages someone has to act on were the three that were silent, and the
 * first Obana heard of them was the customer asking.
 *
 * These pin the two halves of the fix: that every status now has a stage name
 * to send, and that naming it for operations does not change what the
 * customer is told.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'shipmentsController.js'), 'utf8');

/* The controller opens a database connection on require, so the pieces under
   test are lifted out of the source instead. Same approach as
   adminWhatsApp.test.js, and the markers are asserted so a rename fails here
   loudly rather than silently testing nothing. */
const slice = (from, to) => {
    const a = src.indexOf(from);
    const b = src.indexOf(to, a + 1);
    assert.ok(a !== -1, `marker not found in shipmentsController.js: ${from}`);
    assert.ok(b > a, `end marker not found after it: ${to}`);
    return src.slice(a, b);
};

// eslint-disable-next-line no-eval
const { ADMIN_STAGE_LABELS, adminStageLabel } = eval(
    `(() => { ${slice('const ADMIN_STAGE_LABELS =', '/**\n * Tell Obana a shipment reached a stage')} ; return { ADMIN_STAGE_LABELS, adminStageLabel }; })()`,
);

// eslint-disable-next-line no-eval
const { WA_EVENTS } = eval(
    `(() => { ${slice('const WA_EVENTS =', '/**\n * Which customer message a raw status')} ; return { WA_EVENTS }; })()`,
);

// eslint-disable-next-line no-eval
const { CUSTOMER_EVENT } = eval(
    `(() => { ${slice('const CUSTOMER_EVENT =', '/* INTRANSIT or IN_TRANSIT')} ; return { CUSTOMER_EVENT }; })()`,
);

/* Read from the controller rather than copied, so a tenth status added to the
   platform shows up here as a failing test instead of as a stage nobody at
   Obana is told about. That silence is the whole bug this file exists for. */
const validStatuses = JSON.parse(
    `${slice('const validStatuses = [', '];').replace('const validStatuses = ', '')}]`.replace(/'/g, '"'),
);

test('the status list is the one the endpoint actually accepts', () => {
    assert.deepEqual(validStatuses, [
        'pending', 'confirmed', 'picked_up', 'dispatched',
        'in_transit', 'delivered', 'failed', 'cancelled', 'returned',
    ]);
});

/* The point of the change. Each of these reached notifyShipmentEvent and was
   dropped at `if (!cfg) return` because WA_EVENTS has no entry for it. */
test('every status Obana can set has a stage name to send', () => {
    for (const status of validStatuses) {
        const label = adminStageLabel(status);
        assert.ok(label, `${status} has no stage name`);
        assert.notEqual(label, 'Updated', `${status} falls through to the generic label`);
    }
});

test('the stages that were silent are the ones that shout', () => {
    // Previously: no customer template, so no message to anybody at all.
    assert.equal(adminStageLabel('failed'), 'FAILED');
    assert.equal(adminStageLabel('cancelled'), 'CANCELLED');
    assert.equal(adminStageLabel('returned'), 'RETURNED');
});

/* A stage added next month must still reach Obana without anyone remembering
   to add it to ADMIN_STAGE_LABELS. The fallback is the guarantee, not a
   nicety — the status list has already grown twice. */
test('a status nobody has mapped yet still sends something readable', () => {
    assert.equal(adminStageLabel('out_for_delivery'), 'Out For Delivery');
    assert.equal(adminStageLabel('held_at_customs'), 'Held At Customs');
    assert.equal(adminStageLabel('AWAITING_PICKUP'), 'Awaiting Pickup');
});

test('a missing or empty event is still sendable, never blank', () => {
    // '' as a template parameter is what KudiSMS rejects the whole message for.
    for (const junk of [undefined, null, '', '   ']) {
        assert.equal(adminStageLabel(junk), 'Updated');
    }
});

/* Operations and the customer are told at different levels of detail, which
   is the reason the raw status is passed through instead of translated at the
   call site. "In Transit" does not tell a dispatcher whether a driver has the
   parcel yet. */
test('one customer message covers the three moving stages', () => {
    for (const status of ['picked_up', 'dispatched', 'in_transit']) {
        const event = CUSTOMER_EVENT[status] ?? status;
        assert.ok(WA_EVENTS[event], `${status} should still reach the customer`);
        assert.equal(event, 'in_transit');
    }
});

test('but Obana is told which of the three it actually is', () => {
    assert.equal(adminStageLabel('picked_up'), 'Picked up');
    assert.equal(adminStageLabel('dispatched'), 'Dispatched');
    assert.equal(adminStageLabel('in_transit'), 'In transit');
    // Three distinct names behind one customer message.
    assert.equal(new Set(['picked_up', 'dispatched', 'in_transit'].map(adminStageLabel)).size, 3);
});

/* What the customer is told must not change. Before the fix these three
   statuses were the only ones that notified anybody; a regression here is a
   customer who stops hearing about their own parcel. */
test('the three customer-facing stages are untouched', () => {
    assert.ok(WA_EVENTS.created, 'created still messages the customer');
    assert.ok(WA_EVENTS.in_transit, 'in transit still messages the customer');
    assert.ok(WA_EVENTS.delivered, 'delivered still messages the customer');
    assert.equal(Object.keys(WA_EVENTS).length, 3, 'no new customer template was invented');
});

/* Deliberately NOT mapped: a customer should not get an automatic WhatsApp
   saying their shipment failed. What to tell them is a decision for whoever
   picks it up — Obana gets the alert so that someone can. */
test('a failure alerts Obana without auto-messaging the customer', () => {
    for (const status of ['failed', 'cancelled', 'returned', 'pending', 'confirmed']) {
        assert.equal(WA_EVENTS[CUSTOMER_EVENT[status] ?? status], undefined, `${status} should not auto-message the customer`);
        assert.ok(adminStageLabel(status), `${status} should still alert Obana`);
    }
});

test('every mapped label is a label, not an enum leaking out', () => {
    for (const [status, label] of Object.entries(ADMIN_STAGE_LABELS)) {
        assert.ok(!label.includes('_'), `${status} reads as a raw status: ${label}`);
        assert.equal(label, label.trim());
    }
});
