const express = require('express')
const router = express.Router()
const { requireServiceSecret } = require('../helpers/webhookAuth')
const controller = require('../controllers/vendorShipmentController')

/* Server-to-server only. Tajiri holds TAJIRI_SERVICE_SECRET and forwards the
   vendor's choice; no vendor ever reaches this service with a token of their
   own, and nothing here needs or receives customer information. */
router.use(requireServiceSecret)

// The three statuses a vendor may set, so the dashboard need not hard-code them.
router.get('/statuses', controller.options)

// Current status for a page of orders, in one call rather than one per row.
router.post('/lookup', controller.lookup)

// A vendor moved a shipment along.
router.post('/status', controller.setStatus)

module.exports = router
