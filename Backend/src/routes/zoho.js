const express = require('express')
const router = express.Router()
const { requireWebhookSecret } = require('../helpers/webhookAuth')
const { logZohoRequests, recent } = require('../helpers/zohoRequestLog')
const controller = require('../controllers/zohoShipmentController')

/* Zoho's webhook body format is XML, which neither express.json nor
   express.urlencoded parses — so an XML body arrives as an empty object and
   whatever it carried is simply gone. Capture it as text, so at worst it is
   visible and at best it is usable. */
router.use(
    express.text({
        type: ['text/xml', 'application/xml', 'text/plain', 'application/*+xml'],
        // Same reason as the JSON limit in app.js: a workflow rule posts the
        // whole sales order, and the default 100kb turns a large order into a
        // 413 before this router is reached.
        limit: '10mb',
    })
)

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

/* Replay every manual route order Zoho has that never produced a shipment.
 *
 * The 413s left nothing behind on this side — Express refused the body
 * before any route ran, so there is no requests row to replay FROM. The
 * only record is in Zoho's own webhook log, which we cannot query. So this
 * works from state instead: ask Zoho for its recent sales orders, keep the
 * manual route ones, and run the flow for any we have no shipment for.
 *
 * Safe to run repeatedly. handleManualRouteOrder looks for a shipping with
 * the order's reference before it does anything, so an order that did go
 * through has its status refreshed rather than a second shipment booked.
 *
 * Behind the same webhook secret as the trigger: it books real shipments.
 */
router.post('/replay-manual-route-orders', requireWebhookSecret, async (req, res) => {
    const zoho = require('../helpers/zohoInventory')
    const { replayManualRouteOrder, isManualRouteOrder } = require('../helpers/webHooksHelper')
    const db = require('../models/db.js')

    const days = Math.min(Math.max(Number(req.query.days || req.body?.days || 30), 1), 90)
    // 200 is the ceiling for a scan; a named list is bounded by the list
    // itself, and two months of failures is about thirty orders.
    const limit = Math.min(Math.max(Number(req.query.limit || req.body?.limit || 50), 1), 200)
    const dryRun = String(req.query.dry_run || req.body?.dry_run || '') === 'true'

    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

    /* An explicit list beats a date scan when you have one.
     *
     * Zoho's failure log names the orders outright (SO-00660 … SO-00722,
     * two months of them), and looking each one up is a handful of calls
     * against a scan of every sales order in the window — most of which are
     * not route orders at all. It is also exact: no order silently missed
     * because the window or the page size fell short. */
    const wanted = String(
        req.query.salesorder_numbers || req.body?.salesorder_numbers || ''
    )
        .split(/[\s,]+/)
        .map((n) => n.trim())
        .filter(Boolean)

    const replayed = []
    const skipped = []
    const failed = []

    try {
        if (wanted.length > 0) {
            for (const ref of wanted.slice(0, limit)) {
                try {
                    const brief = await zoho.findSalesOrderByNumber(ref)
                    if (!brief) {
                        skipped.push({ ref, reason: 'no such sales order in Zoho' })
                        continue
                    }
                    const order = await zoho.getSalesOrder(brief.salesorder_id)
                    if (!order || !isManualRouteOrder(order)) {
                        skipped.push({ ref, reason: 'not a manual route order' })
                        continue
                    }
                    const existing = await db.shippings.findOne({
                        where: { order_reference: order.salesorder_number },
                    })
                    if (existing) {
                        skipped.push({ ref, reason: 'shipment already exists' })
                        continue
                    }
                    if (dryRun) {
                        replayed.push({ ref, dryRun: true })
                        continue
                    }
                    replayed.push({ ref, result: await replayManualRouteOrder(order) })
                } catch (error) {
                    failed.push({
                        ref,
                        error: error?.response?.data?.message || error.message,
                    })
                }
            }
            return res.status(200).json({
                success: true,
                mode: 'by_number',
                requested: wanted.length,
                replayed: replayed.length,
                skipped: skipped.length,
                failed: failed.length,
                details: { replayed, skipped, failed },
            })
        }

        /* One page is deliberate. This books shipments and writes back to
           Zoho three times per order; a hundred at once is a lot of moving
           parts to start from one request, and the caller can run it again. */
        const list = await zoho.call('GET', '/salesorders', {
            params: { date_start: since, per_page: 200, sort_column: 'date', sort_order: 'D' },
        })
        const candidates = (list?.salesorders || []).slice(0, limit)

        for (const brief of candidates) {
            const ref = brief.salesorder_number
            try {
                // The list view carries no line_items, and the route item is
                // what decides whether this order is ours at all.
                const order = await zoho.getSalesOrder(brief.salesorder_id)
                if (!order || !isManualRouteOrder(order)) {
                    skipped.push({ ref, reason: 'not a manual route order' })
                    continue
                }
                const existing = await db.shippings.findOne({ where: { order_reference: ref } })
                if (existing) {
                    skipped.push({ ref, reason: 'shipment already exists' })
                    continue
                }
                if (dryRun) {
                    replayed.push({ ref, dryRun: true })
                    continue
                }
                const result = await replayManualRouteOrder(order)
                replayed.push({ ref, result })
            } catch (error) {
                failed.push({ ref, error: error?.response?.data?.message || error.message })
            }
        }

        return res.status(200).json({
            success: true,
            window: { since, days },
            checked: candidates.length,
            replayed: replayed.length,
            skipped: skipped.length,
            failed: failed.length,
            details: { replayed, skipped, failed },
        })
    } catch (error) {
        console.error('[zoho replay] failed:', error?.response?.data || error.message)
        return res.status(500).json({
            success: false,
            message: error?.response?.data?.message || error.message,
            partial: { replayed, skipped, failed },
        })
    }
})

// And the other direction: a status changed in Zoho, pushed back onto the
// Obana shipment so the two never disagree about where a parcel is.
router.post('/shipment-status', requireWebhookSecret, controller.statusFromZoho)

// Which Books contact a phone or email resolves to. Read-only: it creates
// nothing, and it is the only way to see why a customer who exists was not
// found without deploying a guess to find out.
router.get('/contact-probe', requireWebhookSecret, controller.contactProbe)

// Which WhatsApp templates are configured. Booleans only — the codes are
// credentials and are never returned.
router.get('/notification-config', requireWebhookSecret, controller.notificationConfig)

module.exports = router
