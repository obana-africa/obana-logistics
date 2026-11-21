/**
 * Async route handlers that fail loudly instead of hanging.
 *
 * Express 4 does not forward a rejected promise to the error middleware. An
 * async handler that throws therefore sends NO response at all: the request
 * hangs until the client gives up, the browser reports a generic network
 * failure, and the error middleware below never runs — so nothing is logged
 * naming the route, the input or the stack.
 *
 * That is how "We couldn't get prices just now. Please try again." came to
 * be the entire diagnosis of a quote failing. The message is the frontend's
 * fallback for a response that carried no message, which is what a timeout
 * looks like, and there was nothing on the server side to pair it with.
 *
 * Wrapping is all it takes: a rejection becomes next(err), which reaches the
 * handler in app.js, which logs the stack and answers with JSON the caller
 * can actually read.
 */

/** One handler, with its rejections routed to the error middleware. */
const asyncRoute = (handler) =>
    function wrapped(req, res, next) {
        try {
            const out = handler.call(this, req, res, next)
            /* Only a thenable is chained, so an ordinary synchronous handler
               is left exactly as it was. */
            if (out && typeof out.then === 'function') out.catch(next)
            return out
        } catch (error) {
            /* A handler that throws before returning a promise. */
            next(error)
        }
    }

/**
 * Every function on a controller, wrapped.
 *
 * Applied where the controller is required, so a new route cannot be added
 * without it — the alternative is remembering to wrap each handler, and the
 * one nobody remembers is the one that hangs.
 */
const wrapAll = (controller) => {
    const out = {}
    for (const [name, value] of Object.entries(controller)) {
        out[name] = typeof value === 'function' ? asyncRoute(value) : value
    }
    return out
}

module.exports = { asyncRoute, wrapAll }
