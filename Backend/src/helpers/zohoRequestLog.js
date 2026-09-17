/**
 * The last few requests Zoho made, kept in memory.
 *
 * Every failure in this integration has been diagnosed by asking someone to
 * find a line in a server log on another machine, paste it, and wait for a
 * reply. That loop has cost days. The one thing never directly observable was
 * what Zoho actually sent — and almost every fault turned out to be exactly
 * that: a placeholder that did not resolve, a parameter in the wrong place, a
 * webhook that timed out before the work finished.
 *
 * So record it. Small, in-memory, no dependencies: it survives as long as the
 * process and disappears on deploy, which is all a diagnostic needs to be.
 */

const LIMIT = Number(process.env.ZOHO_REQUEST_LOG_LIMIT) || 40

const entries = []

/** Secrets are recorded as present or absent, never echoed back. */
const redact = (value) => {
    if (!value || typeof value !== 'object') return value
    const out = {}
    for (const [k, v] of Object.entries(value)) {
        out[k] = /secret|token|key|password/i.test(k) ? (v ? '<present>' : '<empty>') : v
    }
    return out
}

const record = (entry) => {
    entries.unshift({ at: new Date().toISOString(), ...entry })
    if (entries.length > LIMIT) entries.length = LIMIT
}

/**
 * Express middleware. Records the request as it arrives and the answer as it
 * leaves, so a call can be read as a pair without correlating anything.
 */
const logZohoRequests = (req, res, next) => {
    const started = Date.now()
    const entry = {
        method: req.method,
        path: req.path,
        query: redact(req.query),
        content_type: req.headers['content-type'] ?? null,
        body: req.body && Object.keys(req.body).length ? redact(req.body) : null,
        user_agent: req.headers['user-agent'] ?? null
    }

    const finish = (body) => {
        entry.status = res.statusCode
        entry.took_ms = Date.now() - started
        entry.response = typeof body === 'string' ? body.slice(0, 500) : body
        record(entry)
    }

    const json = res.json.bind(res)
    const send = res.send.bind(res)
    res.json = (body) => { finish(body); return json(body) }
    res.send = (body) => { finish(body); return send(body) }

    // A request that never answers is itself the finding.
    res.on('finish', () => { if (!entry.status) finish(null) })

    next()
}

const recent = (limit = LIMIT) => entries.slice(0, limit)

module.exports = { logZohoRequests, recent }
