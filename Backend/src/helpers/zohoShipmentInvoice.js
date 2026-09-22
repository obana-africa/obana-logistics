const db = require('../models/db')
const zoho = require('./zohoInventory')

/**
 * A Zoho Books invoice for a shipment Obana carried on its own account.
 *
 * Shipping sold through the marketplace is already in the books: it rides on a
 * sales order, the charge is written onto it, and Zoho records the revenue when
 * that order is invoiced. A shipment booked straight on the logistics platform
 * has no such paper — a real delivery, really paid for, invisible to the
 * accounts. This is the missing half, so that revenue across every module adds
 * up in one place.
 *
 * Deliberately narrow about which shipments qualify, because the cost of being
 * wrong is asymmetric: a missing invoice is a gap someone can fill, an invoice
 * for a shipment that was never real is a number in the accounts that has to be
 * found and credited. Only a shipment with no marketplace order behind it is
 * invoiced, and never the same one twice.
 *
 * Off unless ZOHO_INVOICE_SHIPMENTS is set.
 */

const ENABLED = () => String(process.env.ZOHO_INVOICE_SHIPMENTS || '').trim().toLowerCase() === 'true'

/* Invoices raised for a shipment are numbered SHI-… rather than the sequence
   Books hands out, so a glance at the books says where the revenue came from
   and nobody has to open the record to find out. */
const PREFIX = (process.env.ZOHO_SHIPMENT_INVOICE_PREFIX || 'SHI').trim()

const str = (v) => String(v ?? '').trim()
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round2 = (v) => Math.round(num(v) * 100) / 100

/**
 * Whether this shipment is Obana's own sale.
 *
 * createShipment stamps order_reference with the caller's order id, or
 * ORDER-<timestamp> when there wasn't one. A marketplace shipment therefore
 * carries a sales order or quote number and is already accounted for; a
 * directly-booked one carries the generated placeholder and is not.
 */
const isDirectShipment = (shipment) => {
    const ref = str(shipment.order_reference)
    if (!ref) return true
    if (/^ORDER-\d+$/i.test(ref)) return true
    // Anything that names a Zoho document belongs to that document's books.
    return !/^(SO|QT|EST|INV)[-\s]/i.test(ref)
}

/** Whoever the delivery is for, as Books needs them. */
const customerOf = async (shipment) => {
    const meta = shipment.metadata || {}
    const fromMeta = meta.customer && typeof meta.customer === 'object' ? meta.customer : {}

    let address = null
    if (shipment.delivery_address_id) {
        address = await db.addresses.findByPk(shipment.delivery_address_id).catch(() => null)
    }

    return {
        zohoId: str(fromMeta.id) || null,
        name: str(fromMeta.name) || str(address?.name) || 'Walk-in Customer',
        email: str(fromMeta.email) || str(address?.contact_email) || '',
        phone: str(fromMeta.phone) || str(address?.phone) || '',
    }
}

/**
 * The Books contact for this customer, found by email and otherwise created.
 *
 * Matched on email rather than name: two people called the same thing are two
 * contacts, and one person whose name was typed differently twice is still one
 * customer. A shipment with no email gets a contact created from the name,
 * which is the best that can be said about a walk-in.
 */
const contactFor = async (customer) => {
    if (customer.zohoId) return customer.zohoId

    if (customer.email) {
        const found = await zoho
            .call('get', 'contacts', { params: { email: customer.email }, books: true })
            .catch(() => null)
        const existing = (found?.contacts || [])[0]
        if (existing?.contact_id) return String(existing.contact_id)
    }

    const created = await zoho.call('post', 'contacts', {
        books: true,
        data: {
            contact_name: customer.name,
            contact_type: 'customer',
            ...(customer.email || customer.phone
                ? {
                      contact_persons: [
                          {
                              first_name: customer.name.split(/\s+/)[0] || customer.name,
                              last_name: customer.name.split(/\s+/).slice(1).join(' ') || '-',
                              ...(customer.email ? { email: customer.email } : {}),
                              ...(customer.phone ? { phone: customer.phone } : {}),
                              is_primary_contact: true,
                          },
                      ],
                  }
                : {}),
        },
    })
    return String(created?.contact?.contact_id ?? '')
}

/** A short description of the journey, so the invoice line says what was sold. */
const describe = async (shipment) => {
    const [pickup, delivery] = await Promise.all([
        shipment.pickup_address_id ? db.addresses.findByPk(shipment.pickup_address_id).catch(() => null) : null,
        shipment.delivery_address_id ? db.addresses.findByPk(shipment.delivery_address_id).catch(() => null) : null,
    ])
    const place = (a) => [str(a?.city), str(a?.state)].filter(Boolean).join(', ') || 'Obana'
    return `Delivery ${place(pickup)} → ${place(delivery)} (${shipment.shipment_reference})`
}

/**
 * Raise the invoice.
 *
 * The books are kept in USD and the shipment is priced in naira, so the fee is
 * converted with the same rate the rest of this integration uses — one rate, so
 * a shipment's charge and its invoice cannot disagree. Both figures are recorded
 * on the shipment, because the day someone asks why an invoice says $6.80 the
 * answer needs to be in the data rather than in a rate that has since moved.
 */
const invoiceShipment = async (shipment) => {
    if (!ENABLED()) return { skipped: 'ZOHO_INVOICE_SHIPMENTS is off' }
    if (!shipment) return { skipped: 'no shipment' }

    // Never twice for the same shipment.
    const already = shipment.metadata?.books_invoice
    if (already?.invoice_id) return { skipped: 'already invoiced', invoice: already }

    if (!isDirectShipment(shipment)) {
        return { skipped: `${shipment.order_reference} is a marketplace order — already in the books` }
    }

    const feeNgn = round2(shipment.shipping_fee)
    if (!(feeNgn > 0)) return { skipped: 'no shipping fee to invoice' }

    try {
        const customer = await customerOf(shipment)
        const contactId = await contactFor(customer)
        if (!contactId) return { skipped: 'could not resolve a Books contact' }

        const currency = str(shipment.currency).toUpperCase() || 'NGN'
        const today = new Date().toISOString().slice(0, 10)

        /* Books is on USD. Convert with Zoho's own naira rate rather than any
           other source, so the invoice agrees with every other figure this
           integration writes. */
        let amount = feeNgn
        let rate = 1
        let rateSource = 'none (already NGN in a NGN book)'
        if (currency === 'NGN') {
            const naira = await zoho.getNairaRate(today).catch(() => null)
            if (naira?.rate > 0) {
                rate = naira.rate
                amount = round2(feeNgn / rate)
                rateSource = `zoho_currency_settings @ ${naira.effective_date ?? today}`
            }
        }

        const invoice = await zoho.call('post', 'invoices', {
            books: true,
            params: { ignore_auto_number_generation: true },
            data: {
                customer_id: contactId,
                /* SHI-A0RP5236, not SHI-20260922-A0RP5236. The date is
                   already the invoice date and the code alone identifies the
                   shipment, so carrying both makes a number nobody can read
                   aloud or type from memory. */
                invoice_number: `${PREFIX}-${shipment.shipment_reference.split('-').pop()}`,
                date: today,
                reference_number: shipment.shipment_reference,
                line_items: [
                    {
                        name: 'Obana Logistics delivery',
                        description: await describe(shipment),
                        rate: amount,
                        quantity: 1,
                    },
                ],
                notes: `Raised automatically for shipment ${shipment.shipment_reference}.`,
            },
        })

        const created = invoice?.invoice
        if (!created?.invoice_id) return { error: 'Zoho accepted the request but returned no invoice' }

        const record = {
            invoice_id: String(created.invoice_id),
            invoice_number: created.invoice_number,
            amount,
            currency_charged: currency,
            amount_ngn: feeNgn,
            ngn_rate: rate,
            rate_source: rateSource,
            at: new Date().toISOString(),
        }
        await shipment.update({ metadata: { ...(shipment.metadata || {}), books_invoice: record } }).catch(() => {})

        console.log(
            `[BOOKS INVOICE] ${shipment.shipment_reference} → ${created.invoice_number} ` +
                `(₦${feeNgn} @ ${rate} = ${amount})`
        )
        return { invoiced: true, ...record }
    } catch (error) {
        /* Never let the accounts cost a delivery. A shipment that could not be
           invoiced is still a shipment, and the gap is recoverable; a booking
           that failed because Books was slow is not. */
        console.error(
            `[BOOKS INVOICE] ${shipment.shipment_reference} failed:`,
            error?.zoho || error?.response?.data?.message || error.message
        )
        return { error: error?.message ?? String(error) }
    }
}

module.exports = { invoiceShipment, isDirectShipment, ENABLED }
