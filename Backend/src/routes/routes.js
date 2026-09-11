const express = require('express')
const router = express.Router()
const controller = require('../controllers/routesController')
const auth = require('../routes/auth')
const { rateLimit } = require('../helpers/rateLimit')

router.get('/', auth.authenticateToken, auth.verifyRole(['admin']), controller.listTemplates)
router.post('/', auth.authenticateToken, auth.verifyRole(['admin']), controller.createTemplate)
router.get('/:id', auth.authenticateToken, auth.verifyRole(['admin']), controller.getTemplate)
router.put('/:id', auth.authenticateToken, auth.verifyRole(['admin']), controller.updateTemplate)
router.delete('/:id', auth.authenticateToken, auth.verifyRole(['admin']), controller.deleteTemplate)

// Matching endpoint
router.post('/match', auth.authenticateToken, controller.matchTemplate)
// Public price check for the website (no login).
router.post('/quote', rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many quotes in a short time. Please wait a few minutes and try again.' }), controller.publicQuote)
router.post('/partner-quotes/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin']), controller.partnerQuotesForShipment)
router.post('/zohoitem', controller.createTemplateFromZoho)

module.exports = router
