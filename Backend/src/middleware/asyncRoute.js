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

/**
 * One handler, with its rejections routed to the error middleware.
 *
 * Every argument is forwarded, and the wrapper only behaves like middleware
 * when it was actually called as middleware — that is, when a third argument
 * was passed and it is a function.
 *
 * Both of those matter, and the first cost an outage to learn. A controller
 * module does not only export route handlers: userController also exports
 * getUser(email, phone, withAttr, req, res, user_id), which auth.js calls
 * directly with six arguments. Wrapping it as `function (req, res, next)`
 * silently truncated that call to three, so the store-key branch — which
 * passes a null email and identifies the user by the SIXTH argument — looked
 * up nothing, found no user, and answered "Invalid or paused store API key"
 * for every store key in existence. The key was never the problem.
 *
 * Forwarding everything makes the wrapper transparent to a direct call: it
 * returns the same promise and throws the same error. Checking `next` is
 * what keeps it from swallowing an error that nobody asked it to route.
 */
const asyncRoute = (handler) =>
    function wrapped(...args) {
        const next = args[2]
        const isMiddleware = args.length >= 3 && typeof next === 'function'
        try {
            const out = handler.apply(this, args)
            /* Only a thenable is chained, so an ordinary synchronous handler
               is left exactly as it was. */
            if (isMiddleware && out && typeof out.then === 'function') out.catch(next)
            return out
        } catch (error) {
            /* A handler that throws before returning a promise. Rethrown when
               this is not middleware, so a direct caller's try/catch still
               sees what it has always seen. */
            if (!isMiddleware) throw error
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
