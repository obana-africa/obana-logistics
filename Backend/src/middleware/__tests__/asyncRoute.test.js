// Run: node --test src/middleware/__tests__/
// Express 4 drops a rejected promise from an async handler on the floor, so
// these pin the one behaviour that turns a crash into a message.

const test = require('node:test')
const assert = require('node:assert/strict')
const { asyncRoute, wrapAll } = require('../asyncRoute')

const run = (handler) =>
    new Promise((resolve) => {
        const res = { sent: null, status() { return this }, send(b) { this.sent = b; resolve({ next: null, res: this }) } }
        asyncRoute(handler)({}, res, (err) => resolve({ next: err, res }))
        /* A handler that neither answers nor rejects is the hang this exists
           to rule out, so the test does not wait forever for one. */
        setTimeout(() => resolve({ next: null, res, hung: true }), 50)
    })

test('an async handler that throws reaches the error middleware', async () => {
    const { next } = await run(async () => {
        throw new Error('no route for 45 kg')
    })
    assert.ok(next instanceof Error)
    assert.equal(next.message, 'no route for 45 kg')
})

test('a rejected promise is an error, not a hang', async () => {
    const { next, hung } = await run(() => Promise.reject(new Error('boom')))
    assert.ok(!hung, 'the request hung instead of erroring')
    assert.equal(next.message, 'boom')
})

test('a handler that throws before returning a promise is caught too', async () => {
    const { next } = await run(() => {
        throw new TypeError('read of undefined')
    })
    assert.ok(next instanceof TypeError)
})

test('a handler that answers normally is left alone', async () => {
    const { next, res } = await run(async (_req, r) => r.status(200).send({ ok: true }))
    assert.equal(next, null)
    assert.deepEqual(res.sent, { ok: true })
})

test('a synchronous handler still works', async () => {
    const { next, res } = await run((_req, r) => r.status(200).send('fine'))
    assert.equal(next, null)
    assert.equal(res.sent, 'fine')
})

test('wrapAll covers every handler on a controller and leaves the rest', () => {
    const wrapped = wrapAll({ a: async () => {}, b: () => {}, NOT_A_HANDLER: 42 })
    assert.equal(typeof wrapped.a, 'function')
    assert.equal(typeof wrapped.b, 'function')
    assert.equal(wrapped.NOT_A_HANDLER, 42)
})

/* A controller module does not only export route handlers.
 *
 * userController also exports getUser(email, phone, withAttr, req, res,
 * user_id), which auth.js calls directly with six arguments. The first
 * version of this wrapper declared `function (req, res, next)` and so
 * truncated that call to three — dropping the user_id that the store-key
 * branch identifies the user BY, since it passes a null email. Every store
 * key in existence was answered "Invalid or paused store API key", and the
 * keys were all fine. These pin the two properties that prevent it. */

test('every argument is forwarded, not just the first three', async () => {
    const seen = []
    const helper = async (...args) => {
        seen.push(...args)
        return 'ok'
    }
    const out = await asyncRoute(helper)(null, null, true, 'REQ', 'RES', 42)
    assert.equal(out, 'ok')
    assert.deepEqual(seen, [null, null, true, 'REQ', 'RES', 42])
})

test('a direct call that throws rethrows, instead of being swallowed', async () => {
    const helper = async () => {
        throw new Error('not found')
    }
    await assert.rejects(() => asyncRoute(helper)('a@b.c', null, true), /not found/)
})

test('a direct call with a non-function third argument is not middleware', async () => {
    /* `true` sits where `next` would, and must not be called. */
    const helper = async (a, b, c) => `${a}|${b}|${c}`
    assert.equal(await asyncRoute(helper)(null, null, true), 'null|null|true')
})
