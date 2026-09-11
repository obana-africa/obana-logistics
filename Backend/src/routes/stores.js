const express = require('express')
const router = express.Router()
const controller = require('../controllers/storesController')
const auth = require('../routes/auth')

// For store API keys (integrations)
router.get('/me', auth.authenticateToken, controller.currentStore)
router.get('/me/shipments', auth.authenticateToken, controller.currentStoreShipments)

// For the store owner, signed in to their Obana account
router.get('/', auth.authenticateToken, controller.listStores)
router.post('/', auth.authenticateToken, controller.createStore)
router.get('/:id', auth.authenticateToken, controller.getStore)
router.put('/:id', auth.authenticateToken, controller.updateStore)
router.post('/:id/rotate-key', auth.authenticateToken, controller.rotateKey)
router.post('/:id/webhook-secret', auth.authenticateToken, controller.rotateWebhookSecret)
router.post('/:id/test-webhook', auth.authenticateToken, controller.testWebhook)
router.get('/:id/webhooks', auth.authenticateToken, controller.listDeliveries)
router.get('/:id/shipments', auth.authenticateToken, controller.storeShipments)
router.get('/:id/customers', auth.authenticateToken, controller.storeCustomers)

module.exports = router
