const { wrapAll } = require('../middleware/asyncRoute')
const express = require('express')
const router = express.Router()
const controller = wrapAll(require('../controllers/webhookController'))
const auth = require('../routes/auth')

/**
 * What the webhooks actually did.
 *
 * webhookController.getWebhookLogs has existed all along and was wired to no
 * route, so the only record of a webhook failing lived in a table nobody
 * could read without a database client. That is the whole reason a Zoho sales
 * order could come through, fail to produce a shipment, and leave no trace
 * anybody would find: Zoho showed Success, the Obana admin showed no
 * shipment, and the error message sat in webhook_logs unreachable.
 *
 * Admin-only. A webhook log carries the payload that was posted — customer
 * names, addresses, line items — so it is not something a store key should
 * reach.
 *
 *   GET /webhooks/logs                      the most recent, newest first
 *   GET /webhooks/logs?processed=false      the ones that did not work
 *   GET /webhooks/logs?event_type=manual_route_order_failed
 */
router.get(
    '/logs',
    auth.authenticateToken,
    auth.verifyRole(['admin']),
    controller.getWebhookLogs
)

module.exports = router
