const express = require('express')
const router = express.Router()
const { requireWebhookSecret } = require('../helpers/webhookAuth')
const controller = require('../controllers/zohoShipmentController')

// Zoho Inventory calls this from a workflow rule on Sales Orders when ops sets
// cf_create_shipment to "Via Obana". Guarded by the shared secret Zoho sends as
// x-webhook-secret or ?secret=, the same way the route-item webhook is.
router.post('/shipment-trigger', requireWebhookSecret, controller.triggerFromSalesOrder)

// And the other direction: a status changed in Zoho, pushed back onto the
// Obana shipment so the two never disagree about where a parcel is.
router.post('/shipment-status', requireWebhookSecret, controller.statusFromZoho)

module.exports = router
