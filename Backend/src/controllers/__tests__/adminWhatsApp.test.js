/* Who at Obana hears about a shipment.
 *
 * Every shipment on this platform — raised from the logistics dashboard, the
 * marketplace, or a partner store's API key — is somebody's parcel that
 * somebody here may have to answer for. Until this, the only people told were
 * the two ends of the journey, so the first anyone at Obana heard of a
 * shipment going wrong was the customer asking about it.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'shipmentsController.js'), 'utf8');
const from = src.indexOf('const DEFAULT_ADMIN_WHATSAPP =');
const to = src.indexOf('/**\n * WhatsApp notification config');
// eslint-disable-next-line no-eval
const { adminWhatsAppNumbers, DEFAULT_ADMIN_WHATSAPP } = eval(
    `(() => { ${src.slice(from, to)} ; return { adminWhatsAppNumbers, DEFAULT_ADMIN_WHATSAPP }; })()`,
);

const withEnv = (value, fn) => {
    const had = Object.hasOwn(process.env, 'ADMIN_WHATSAPP_NUMBERS');
    const before = process.env.ADMIN_WHATSAPP_NUMBERS;
    if (value === undefined) delete process.env.ADMIN_WHATSAPP_NUMBERS;
    else process.env.ADMIN_WHATSAPP_NUMBERS = value;
    try {
        fn();
    } finally {
        if (had) process.env.ADMIN_WHATSAPP_NUMBERS = before;
        else delete process.env.ADMIN_WHATSAPP_NUMBERS;
    }
};

test('unset falls back to the number operations runs from', () => {
    withEnv(undefined, () => {
        assert.deepEqual(adminWhatsAppNumbers(), [DEFAULT_ADMIN_WHATSAPP]);
    });
});

/* "Nobody has decided yet" and "nobody" are different answers. An explicit
   empty string is a decision and is honoured; an absent variable is not. */
test('an explicit empty string turns it off', () => {
    withEnv('', () => assert.deepEqual(adminWhatsAppNumbers(), []));
    withEnv('   ', () => assert.deepEqual(adminWhatsAppNumbers(), []));
});

test('a second person on call is an env change, not a deploy', () => {
    withEnv('+2348011111111, +2348022222222', () => {
        assert.deepEqual(adminWhatsAppNumbers(), ['+2348011111111', '+2348022222222']);
    });
});

test('a stray comma or space does not become a recipient', () => {
    withEnv('+2348011111111,,  ,+2348022222222,', () => {
        assert.deepEqual(adminWhatsAppNumbers(), ['+2348011111111', '+2348022222222']);
    });
});

/* The dedup the send path does, pinned here because the formats really do
   differ between the two places a number is typed: a customer's address holds
   "09036724938" and the env holds "+2349036724938". Matching on the last nine
   digits is what stops the admin being messaged twice when they are also the
   sender. */
test('the same number in two formats is one person', () => {
    const digitsOf = (phone) => String(phone ?? '').replace(/\D/g, '').slice(-9);
    assert.equal(digitsOf('+2349036724938'), digitsOf('09036724938'));
    assert.equal(digitsOf('+2349036724938'), digitsOf('234 903 672 4938'));
    assert.notEqual(digitsOf('+2349036724938'), digitsOf('+2348011111111'));
});
