const { Op } = require('sequelize')
const db = require('../models/db')

const MAX_ROWS = 10000
const DAY = /^\d{4}-\d{2}-\d{2}$/
const MOVED = ['picked_up', 'dispatched', 'in_transit']

const str = (value) => {
    const s = String(value ?? '').trim()
    return s || null
}

const place = (address) =>
    address ? { city: str(address.city), state: str(address.state), country: str(address.country) } : null

const report = async (req, res) => {
    const from = str(req.query.from)
    const to = str(req.query.to)
    if (!DAY.test(from || '') || !DAY.test(to || '') || from > to) {
        return res.status(400).json({ success: false, message: 'from and to must be YYYY-MM-DD dates, with from on or before to' })
    }

    try {
        const shipments = await db.shippings.findAll({
            where: {
                createdAt: { [Op.gte]: new Date(`${from}T00:00:00Z`), [Op.lt]: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000) }
            },
            attributes: [
                'id',
                'shipment_reference',
                'order_reference',
                'vendor_name',
                'status',
                'carrier_type',
                'carrier_name',
                'transport_mode',
                'service_level',
                'shipping_fee',
                'product_value',
                'currency',
                'total_weight',
                'total_items',
                'metadata',
                'actual_delivery_at',
                'createdAt',
                'updatedAt'
            ],
            include: [
                { model: db.addresses, as: 'pickup_address', attributes: ['city', 'state', 'country'] },
                { model: db.addresses, as: 'delivery_address', attributes: ['city', 'state', 'country'] },
                { model: db.drivers, as: 'driver', attributes: ['driver_code', 'vehicle_type'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: MAX_ROWS + 1
        })

        const truncated = shipments.length > MAX_ROWS
        const rows = truncated ? shipments.slice(0, MAX_ROWS) : shipments

        const events = rows.length
            ? await db.shipment_tracking.findAll({
                  where: { shipment_id: rows.map((s) => s.id), status: [...MOVED, 'delivered'] },
                  attributes: ['shipment_id', 'status', 'createdAt'],
                  raw: true
              })
            : []
        const firstAt = new Map()
        for (const e of events) {
            const key = `${e.shipment_id}:${MOVED.includes(e.status) ? 'moved' : e.status}`
            const at = new Date(e.createdAt)
            if (!firstAt.has(key) || at < firstAt.get(key)) firstAt.set(key, at)
        }

        return res.status(200).json({
            success: true,
            from,
            to,
            count: rows.length,
            truncated,
            shipments: rows.map((s) => {
                const zoho = s.metadata?.zoho || {}
                return {
                    shipment_reference: s.shipment_reference,
                    order_reference: s.order_reference,
                    salesorder_id: str(zoho.salesorder_id),
                    vendor: str(s.vendor_name),
                    status: s.status,
                    carrier_type: s.carrier_type,
                    carrier_name: str(s.carrier_name),
                    transport_mode: s.transport_mode,
                    service_level: s.service_level,
                    shipping_fee: Number(s.shipping_fee) || 0,
                    product_value: Number(s.product_value) || 0,
                    currency: s.currency || 'NGN',
                    total_weight: Number(s.total_weight) || 0,
                    total_items: Number(s.total_items) || 0,
                    pickup: place(s.pickup_address),
                    delivery: place(s.delivery_address),
                    driver: s.driver ? { code: s.driver.driver_code, vehicle: s.driver.vehicle_type } : null,
                    booked_at: s.createdAt,
                    picked_up_at: firstAt.get(`${s.id}:moved`) || null,
                    delivered_at: s.actual_delivery_at || firstAt.get(`${s.id}:delivered`) || null,
                    updated_at: s.updatedAt
                }
            })
        })
    } catch (error) {
        console.error('[LOGISTICS REPORT] failed:', error?.message || error)
        return res.status(500).json({ success: false, message: error?.message ?? String(error) })
    }
}

module.exports = { report }
