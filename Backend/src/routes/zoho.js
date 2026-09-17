const express = require('express')
const router = express.Router()
const { requireWebhookSecret } = require('../helpers/webhookAuth')
const { logZohoRequests, recent } = require('../helpers/zohoRequestLog')
const controller = require('../controllers/zohoShipmentController')

/* Zoho's webhook body format is XML, which neither express.json nor
   express.urlencoded parses — so an XML body arrives as an empty object and
   whatever it carried is simply gone. Capture it as text, so at worst it is
   visible and at best it is usable. */
router.use(express.text({ type: ['text/xml', 'application/xml', 'text/plain', 'application/*+xml'] }))

// Record every call Zoho makes, before anything can reject it. What Zoho
// actually sends has been the one unobservable thing in this integration, and
// almost every fault has turned out to be exactly that.
router.use(logZohoRequests)

/** The last few requests Zoho made, and what they were answered with. */
router.get('/recent', (req, res) =>
    res.status(200).json({ success: true, count: recent().length, requests: recent(Number(req.query.limit) || 20) })
)

// Zoho Inventory calls this from a workflow rule on Sales Orders when ops sets
// cf_create_shipment to "Via Obana". Guarded by the shared secret Zoho sends as
// x-webhook-secret or ?secret=, the same way the route-item webhook is.
router.post('/shipment-trigger', requireWebhookSecret, controller.triggerFromSalesOrder)

// And the other direction: a status changed in Zoho, pushed back onto the
// Obana shipment so the two never disagree about where a parcel is.
router.post('/shipment-status', requireWebhookSecret, controller.statusFromZoho)

// Which WhatsApp templates are configured. Booleans only — the codes are
// credentials and are never returned.
router.get('/notification-config', requireWebhookSecret, controller.notificationConfig)

module.exports = router
