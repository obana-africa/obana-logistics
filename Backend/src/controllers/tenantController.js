const { check, validationResult } = require('express-validator')
const crypto = require('crypto')
const db = require('../models/db.js')
const utils = require('../../utils.js')

const Tenants = db.tenants

/**
 * Generate a unique API key for a tenant
 * @returns {string} API key
 */
const generateApiKey = () => {
    return `obana_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Register/Create Tenant (Business Onboarding)
 * @param req
 * @param res
 **/
const registerTenant = async (req, res) => {
    try {
        const { name, slug, base_url, description } = req.body

        // Validate required fields
        if (!name || !slug || !base_url) {
            return res.status(400).send(
                utils.responseError('name, slug, and base_url are required')
            )
        }

        // Check if tenant already exists
        let tenant = await Tenants.findOne({ where: { slug } })
        if (tenant) {
            return res.status(400).send(
                utils.responseError('Business with this slug already registered')
            )
        }

        // Generate API key
        const apiKey = generateApiKey()

        // Create tenant with config containing API key
        tenant = await Tenants.create({
            name,
            slug,
            base_url,
            description,
            config: JSON.stringify({ api_key: apiKey }),
            status: 'active',
            registry: null
        })

        // Return tenant info with API key (only show full key once during registration)
        return res.status(201).send(
            utils.responseSuccess({
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                base_url: tenant.base_url,
                description: tenant.description,
                api_key: apiKey,
                message: '⚠️ Save your API key securely.'
            })
        )
    } catch (error) {
        console.error('Tenant registration error:', error)
        return res.status(500).send(
            utils.responseError(error.message)
        )
    }
}

/**
 * Create Tenant (Admin)
 * @param req
 * @param res
 **/
const createTenant = async (req, res) => {

    let tenant = await Tenants.findOne({ where: { name: req.body.name } })

    if (tenant) {
        return res.status(400).send(
            utils.responseError('Tenant already exist')
        )
    }

    // Generate API key if not provided
    if (!req.body.config) {
        const apiKey = generateApiKey()
        req.body.config = JSON.stringify({ api_key: apiKey })
    }

    if (!req.body.status) {
        req.body.status = 'active'
    }

    tenant = await Tenants.create(req.body)

    return res.status(201).send(utils.responseSuccess(tenant))
}

/**
 * Update Tenant
 * @param req
 * @param res
 **/
const updateTenant = async (req, res) => {
    let tenant = await Tenants.findOne({ where: { name: req.body.name } })
    if (!tenant) {
        return res.status(400).send(
            utils.responseError('Tenant does not exist')
        )
    }
    tenant = await Tenants.update(req.body, { where: { name: req.body.name } })

    return res.status(202).send(utils.responseSuccess(tenant))
}

/**
 * Get Tenant by ID
 * @param req
 * @param res
 **/
const getTenant = async (req, res) => {
    try {
        const tenant = await Tenants.findByPk(req.params.id)
        if (!tenant) {
            return res.status(404).send(
                utils.responseError('Tenant not found')
            )
        }
        return res.status(200).send(utils.responseSuccess(tenant))
    } catch (error) {
        return res.status(500).send(utils.responseError(error.message))
    }
}

/**
 * Get all Tenants
 * @param req
 * @param res
 **/
const getAllTenants = async (req, res) => {
    try {
        const tenants = await Tenants.findAll()
        return res.status(200).send(utils.responseSuccess(tenants))
    } catch (error) {
        return res.status(500).send(utils.responseError(error.message))
    }
}

/**
 * Regenerate API Key for a Tenant
 * @param req
 * @param res
 **/
const regenerateApiKey = async (req, res) => {
    try {
        const tenant = await Tenants.findByPk(req.params.id)
        if (!tenant) {
            return res.status(404).send(
                utils.responseError('Tenant not found')
            )
        }

        // Generate new API key
        const newApiKey = generateApiKey()
        const config = tenant.config ? JSON.parse(tenant.config) : {}
        config.api_key = newApiKey

        // Update tenant
        await tenant.update({ config: JSON.stringify(config) })

        return res.status(200).send(
            utils.responseSuccess({
                id: tenant.id,
                name: tenant.name,
                api_key: newApiKey,
                message: '✅ New API key generated successfully'
            })
        )
    } catch (error) {
        return res.status(500).send(utils.responseError(error.message))
    }
}

/**
 * Validate API Key
 * Returns tenant info if valid
 * @param apiKey
 * @returns {Object} tenant object or null
 */
const validateApiKey = async (apiKey) => {
    try {
        const tenants = await Tenants.findAll()
        for (let tenant of tenants) {
            const config = tenant.config ? JSON.parse(tenant.config) : {}
            if (config.api_key === apiKey && tenant.status === 'active') {
                return tenant
            }
        }
        return null
    } catch (error) {
        console.error('API Key validation error:', error)
        return null
    }
}

module.exports = {
    createTenant,
    registerTenant,
    updateTenant,
    getTenant,
    getAllTenants,
    regenerateApiKey,
    validateApiKey,
    generateApiKey
}