const db = require('../models/db')
const shipmentsController = require('./shipmentsController')
const zohoShipment = require('./zohoShipmentController')
const { trackingUrl } = require('../helpers/shipmentStatus')

/**
 * A vendor moving a shipment along, from the Tajiri vendor dashboard.
 *
 * The vendor never talks to this service directly — Tajiri holds the secret and
 * forwards the change. What arrives is a sales order number and one of three
 * statuses, and nothing about the customer: the vendor dashboard does not show
 * customer information and must not need it to do this.
 *
 * Deliberately the same path an admin or a driver takes. Going through
 * updateShipmentStatus means a vendor's change raises the tracking event, sends
 * the WhatsApp, and writes cf_shipment_status back onto the Zoho sales order,
 * exactly as every other status change does. Nothing here re-implements any of
 * that, and there is one history rather than a vendor one and a real one.
 */

/* What a vendor is allowed to set, keyed by the words Zoho itself uses.
   
   Three, because three is what the Zoho field offers and what the customer sees
   on the tracking page — Package Created, In Transit, Fulfilled. Obana tracks a
   parcel more finely, but those extra stages belong to a dispatcher, not to the
   vendor who packed the box.
   
   Everything else is deliberately absent. failed, cancelled and returned are
   decisions with money attached and stay with logistics and admin; a vendor
   cancelling would have to reach the customer, the refund and the books, and a
   dropdown that moves only the label would be worse than no dropdown at all. */
const VENDOR_STATUS = {
    'package created': 'confirmed',
    package_created: 'confirmed',
    confirmed: 'confirmed',
    'in transit': 'in_transit',
    in_transit: 'in_transit',
    intransit: 'in_transit',
    fulfilled: 'delivered',
    fulfiled: 'delivered',
    delivered: 'delivered'
}

/** The order the three stages happen in, so nothing moves backwards. */
const PROGRESSION = ['pending', 'confirmed', 'picked_up', 'dispatched', 'in_transit', 'delivered']

const str = (value) => {
    if (value === undefined || value === null) return ''
    const text = String(value).trim()
    return text && text !== 'null' && text !== 'undefined' ? text : ''
}

/** The three options a vendor may choose, for the dashboard to render. */
const options = async (_req, res) =>
    res.status(200).json({
        success: true,
        statuses: [
            { value: 'confirmed', label: 'Package Created' },
            { value: 'in_transit', label: 'In Transit' },
            { value: 'delivered', label: 'Fulfilled' }
        ]
    })

const setStatus = async (req, res) => {
    const salesOrderNumber = str(req.body?.salesorder_number) || str(req.query?.salesorder_number)
    const rawStatus = str(req.body?.status)
    const vendorId = str(req.body?.vendor_id)
    const vendorName = str(req.body?.vendor_name)

    if (!salesOrderNumber) {
        return res.status(400).json({ success: false, message: 'salesorder_number is required' })
    }

    const status = VENDOR_STATUS[rawStatus.toLowerCase()]
    if (!status) {
        return res.status(400).json({
            success: false,
            message: `"${rawStatus || ''}" is not a status a vendor can set`,
            allowed: ['Package Created', 'In Transit', 'Fulfilled']
        })
    }

    try {
        /* One order can hold several shipments — the shop and sales-partner
           flows raise one per vendor. Update this vendor's own leg, and never
           somebody else's: taking the first row matched meant a vendor on a
           five-vendor order could move a parcel that was not theirs. */
        const candidates = await db.shippings.findAll({
            where: { order_reference: salesOrderNumber },
            order: [['updatedAt', 'DESC']]
        })
        const isVendorId = (value) => /^\d{6,}$/.test(String(value ?? '').trim())
        const shipment = vendorId
            ? (candidates.find((c) => String(c.vendor_name ?? '').trim() === vendorId) ??
              candidates.find((c) => !isVendorId(c.vendor_name)) ??
              null)
            : (candidates[0] ?? null)

        /* No shipment means ops has not flagged the order for Obana yet. Say so
           plainly rather than raising one: the vendor did not choose the
           carrier and should not be the one who creates the shipment. */
        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: `No Obana shipment for ${salesOrderNumber} yet`,
                hint: 'The order has not been sent to Obana Logistics from Zoho.'
            })
        }

        if (shipment.status === status) {
            return res.status(200).json({
                success: true,
                unchanged: true,
                status,
                zoho_status: zohoShipment.ZOHO_LABEL[status],
                shipment_reference: shipment.shipment_reference,
                tracking_url: trackingUrl(shipment.shipment_reference)
            })
        }

        /* A vendor cannot walk a parcel backwards. The driver is ahead of the
           vendor more often than not — the box is collected and moving while
           the vendor is still working through yesterday's list — and letting a
           late click un-deliver a delivered parcel would re-notify the customer
           with something untrue. */
        const from = PROGRESSION.indexOf(shipment.status)
        const to = PROGRESSION.indexOf(status)
        if (to !== -1 && from !== -1 && to < from) {
            return res.status(409).json({
                success: false,
                message: `This shipment is already ${zohoShipment.ZOHO_LABEL[shipment.status] ?? shipment.status}`,
                status: shipment.status,
                zoho_status: zohoShipment.ZOHO_LABEL[shipment.status] ?? null,
                shipment_reference: shipment.shipment_reference
            })
        }

        /* Delegated, not duplicated. from_zoho stays false so the change is
           written back to the Zoho sales order — that write-back is the whole
           point: Tajiri reads cf_shipment_status from Zoho, so it is how the
           vendor sees their own update reflected, and how the super admin sees
           it too. */
        const captured = {}
        const inner = {
            status(code) { captured.status = code; return this },
            json(body) { captured.body = body; return this },
            send(body) { captured.body = body; return this }
        }
        await shipmentsController.updateShipmentStatus(
            {
                params: { shipment_id: String(shipment.id) },
                body: {
                    status,
                    /* enum_shipment_trackings_source has no 'vendor'. Adding one
                       is a migration on a table the whole platform writes to, for
                       a label; performed_by carries who it was without it. */
                    source: 'system',
                    performed_by: vendorId ? `vendor_${vendorId}` : 'vendor',
                    description: `Marked ${zohoShipment.ZOHO_LABEL[status]} by ${vendorName || 'the vendor'}`
                },
                user: null
            },
            inner
        )

        if ((captured.status ?? 200) >= 400) {
            return res.status(captured.status).json({
                success: false,
                message: captured.body?.message ?? 'Could not update the shipment',
                shipment_reference: shipment.shipment_reference
            })
        }

        console.log(
            `[VENDOR SHIPMENT] ${salesOrderNumber} · ${shipment.shipment_reference} → ${status}` +
                ` by ${vendorName || vendorId || 'vendor'}`
        )

        return res.status(200).json({
            success: true,
            shipment_reference: shipment.shipment_reference,
            status,
            zoho_status: zohoShipment.ZOHO_LABEL[status],
            tracking_url: trackingUrl(shipment.shipment_reference),
            // What the WhatsApp actually did, per audience.
            notification: captured.body?.notification ?? null
        })
    } catch (error) {
        console.error('[VENDOR SHIPMENT] failed:', error?.zoho || error?.message || error)
        return res.status(500).json({ success: false, message: error?.message ?? String(error) })
    }
}

/**
 * The shipment status for a batch of sales orders.
 *
 * The vendor list shows hundreds of rows at a time. Reading cf_shipment_status
 * off each Zoho sales order would be one API call per row against a quota this
 * integration has already exhausted once, and slow enough to be felt.
 *
 * This is the same value. Logistics writes cf_shipment_status onto the order in
 * the first place, and a status changed inside Zoho arrives here by webhook
 * before it is read back — so this table is never behind what Zoho holds, and
 * usually slightly ahead. One query, no Zoho calls.
 */
const lookup = async (req, res) => {
    const numbers = (Array.isArray(req.body?.salesorder_numbers) ? req.body.salesorder_numbers : [])
        .map(str)
        .filter(Boolean)

    if (!numbers.length) {
        return res.status(400).json({ success: false, message: 'salesorder_numbers must be a non-empty array' })
    }
    if (numbers.length > 500) {
        return res.status(400).json({ success: false, message: 'At most 500 sales orders per lookup' })
    }

    const vendorId = str(req.body?.vendor_id)

    try {
        const shipments = await db.shippings.findAll({
            where: { order_reference: [...new Set(numbers)] },
            // Deliberately narrow. The vendor dashboard shows no customer
            // information, so none is selected here — it cannot leak what it
            // never reads. vendor_name is the exception: it is what decides
            // whose shipment this is.
            attributes: ['order_reference', 'shipment_reference', 'status', 'vendor_name', 'updatedAt'],
            order: [['updatedAt', 'DESC']]
        })

        /* An order can hold more than one shipment. The shop and sales-partner
           flows raise one per vendor — a five-vendor order is five shipments,
           each tagged with that vendor's id — while the Zoho flow raises a
           single one for the whole order, tagged 'Obana Africa'.

           Keying only by order number kept whichever row came last, so on a
           multi-vendor order a vendor could be shown, and then update, another
           vendor's leg. */
        const byOrder = new Map()
        for (const s of shipments) {
            if (!byOrder.has(s.order_reference)) byOrder.set(s.order_reference, [])
            byOrder.get(s.order_reference).push(s)
        }

        // A vendor id is the long numeric Zoho id. Anything else — 'Obana
        // Africa', 'Unknown Vendor' — marks a shipment covering the whole
        // order rather than one vendor's part of it.
        const isVendorId = (value) => /^\d{6,}$/.test(String(value ?? '').trim())

        const pick = (rows) => {
            if (!vendorId) return rows[0]
            // This vendor's own leg, when there is one.
            const mine = rows.find((r) => String(r.vendor_name ?? '').trim() === vendorId)
            if (mine) return mine
            // Otherwise an order-level shipment, which belongs to everyone on
            // the order. Never another vendor's leg.
            return rows.find((r) => !isVendorId(r.vendor_name))
        }

        const shipmentsByOrder = {}
        for (const [orderRef, rows] of byOrder) {
            const s = pick(rows)
            if (!s) continue
            shipmentsByOrder[orderRef] = {
                shipment_reference: s.shipment_reference,
                status: s.status,
                zoho_status: zohoShipment.ZOHO_LABEL[s.status] ?? null,
                tracking_url: trackingUrl(s.shipment_reference),
                // So a shared shipment can be told apart from a vendor's own
                // leg, and so this is debuggable from the response itself.
                vendor_scoped: isVendorId(s.vendor_name),
                updated_at: s.updatedAt
            }
        }

        return res.status(200).json({
            success: true,
            count: shipments.length,
            matched: Object.keys(shipmentsByOrder).length,
            shipments: shipmentsByOrder
        })
    } catch (error) {
        console.error('[VENDOR SHIPMENT] lookup failed:', error?.message || error)
        return res.status(500).json({ success: false, message: error?.message ?? String(error) })
    }
}

module.exports = { setStatus, options, lookup, VENDOR_STATUS }

