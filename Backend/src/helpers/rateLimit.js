// Small in-memory rate limiter (per client IP + route). Fine for a single Render instance;
// move to a shared store (e.g. Redis) if the API ever runs on several instances.
const buckets = new Map()

const rateLimit = ({ windowMs, max, message }) => (req, res, next) => {
    const key = `${req.ip}|${req.baseUrl}${req.path}`
    const now = Date.now()
    let bucket = buckets.get(key)
    if (!bucket || bucket.reset <= now) {
        bucket = { count: 0, reset: now + windowMs }
        buckets.set(key, bucket)
    }
    bucket.count += 1
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)))
    if (bucket.count > max) {
        res.setHeader('Retry-After', String(Math.ceil((bucket.reset - now) / 1000)))
        return res.status(429).json({ status: 'error', success: false, message: message || 'Too many requests. Please wait a moment and try again.' })
    }
    next()
}

// Drop expired buckets so memory stays flat.
setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key)
}, 60 * 1000).unref()

module.exports = { rateLimit }
