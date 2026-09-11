const db = require('../models/db')
const utils = require('../../utils')
const { DEFAULT_SLUG } = require('../helpers/partnerPricing')

// Returns a percentage 0–100 (2 decimals), null when explicitly null, or undefined when invalid.
const toPercent = (value) => {
    if (value === null) return null
    const n = Number(value)
    if (value === '' || !Number.isFinite(n) || n < 0 || n > 100) return undefined
    return Math.round(n * 100) / 100
}

const serialize = (row) => ({
    slug: row.slug,
    name: row.name,
    logo_url: row.logo_url,
    enabled: row.enabled,
    markup_percent: row.markup_percent === null ? null : Number(row.markup_percent),
    last_seen_at: row.last_seen_at
})

/** GET /partners — default markup + every partner seen in quotes. */
const listPartners = async (req, res) => {
    try {
        const rows = await db.partners.findAll({ order: [['name', 'ASC']] })
        const defaultRow = rows.find((r) => r.kind === 'default')
        const envDefault = Number(process.env.DEFAULT_PARTNER_MARKUP_PERCENT) || 0
        return res.status(200).send(utils.responseSuccess({
            default_markup_percent: defaultRow && defaultRow.markup_percent !== null ? Number(defaultRow.markup_percent) : envDefault,
            partners: rows.filter((r) => r.kind !== 'default').map(serialize)
        }))
    } catch (error) {
        console.error('List partners failed:', error.message)
        return res.status(500).send(utils.responseError('Could not load partners'))
    }
}

/** PUT /partners/default { markup_percent } */
const updateDefault = async (req, res) => {
    const pct = toPercent(req.body && req.body.markup_percent)
    if (pct === undefined || pct === null) {
        return res.status(400).send(utils.responseError('markup_percent must be a number from 0 to 100'))
    }
    try {
        const [row] = await db.partners.findOrCreate({
            where: { slug: DEFAULT_SLUG },
            defaults: { slug: DEFAULT_SLUG, name: 'Default markup', kind: 'default' }
        })
        await row.update({ markup_percent: pct })
        return res.status(200).send(utils.responseSuccess({ default_markup_percent: pct }))
    } catch (error) {
        console.error('Update default markup failed:', error.message)
        return res.status(500).send(utils.responseError('Could not save the default markup'))
    }
}

/** PUT /partners/:slug { enabled?, markup_percent? (null = use default) } */
const updatePartner = async (req, res) => {
    const { slug } = req.params
    const body = req.body || {}
    if (slug === DEFAULT_SLUG) return res.status(400).send(utils.responseError('Use /partners/default for the default markup'))

    const changes = {}
    if (body.enabled !== undefined) {
        if (typeof body.enabled !== 'boolean') return res.status(400).send(utils.responseError('enabled must be true or false'))
        changes.enabled = body.enabled
    }
    if (body.markup_percent !== undefined) {
        const pct = toPercent(body.markup_percent)
        if (pct === undefined) return res.status(400).send(utils.responseError('markup_percent must be a number from 0 to 100, or null'))
        changes.markup_percent = pct
    }
    if (!Object.keys(changes).length) return res.status(400).send(utils.responseError('Nothing to update'))

    try {
        const row = await db.partners.findOne({ where: { slug, kind: 'carrier' } })
        if (!row) return res.status(404).send(utils.responseError('Partner not found'))
        await row.update(changes)
        return res.status(200).send(utils.responseSuccess(serialize(row)))
    } catch (error) {
        console.error('Update partner failed:', error.message)
        return res.status(500).send(utils.responseError('Could not update the partner'))
    }
}

module.exports = { listPartners, updateDefault, updatePartner }
