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

/**
 * Who the invoice is for: whoever takes delivery.
 *
 * Pickup on these shipments is Obana — the fulfilment centre, or a vendor
 * collecting on Obana's behalf — so the party at the other end is the customer,
 * and the delivery details are the customer's details. A phone number and an
 * email are collected precisely because someone has to be reachable about this
 * parcel, and that someone is the buyer.
 *
 * The name is the least reliable of the three and is treated that way: it is
 * what the contact is called if a new one has to be made, never what an
 * existing one is found by.
 */
const customerOf = async (shipment) => {
    const meta = shipment.metadata || {}
    const fromMeta = meta.customer && typeof meta.customer === 'object' ? meta.customer : {}

    const address = shipment.delivery_address_id
        ? await db.addresses.findByPk(shipment.delivery_address_id).catch(() => null)
        : null

    return {
        zohoId: str(fromMeta.id) || null,
        name: str(address?.name) || str(fromMeta.name) || 'Obana Logistics customer',
        email: str(address?.contact_email) || str(fromMeta.email) || '',
        phone: str(address?.phone) || str(fromMeta.phone) || '',
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
    if (customer.zohoId) return { id: customer.zohoId, found: 'zoho id on the request' }

    /* Email first, then phone. Both identify a person; a name does not, and
       matching on one would merge two customers who happen to share it while
       still missing the same customer typed differently twice.

       Phone is compared on its last nine digits, because the same number is
       written +2348090335245, 08090335245 and 234-809-033-5245 by three
       different people and Zoho stores whatever it was given. */
    if (customer.email) {
        const found = await zoho
            .call('get', 'contacts', { params: { email: customer.email }, books: true })
            .catch(() => null)
        const existing = (found?.contacts || [])[0]
        if (existing?.contact_id) return { id: String(existing.contact_id), found: `email ${customer.email}` }
    }

    const digits = customer.phone.replace(/\D/g, '')
    if (digits.length >= 9) {
        const tail = digits.slice(-9)
        const found = await zoho
            .call('get', 'contacts', { params: { phone: tail }, books: true })
            .catch(() => null)
        const match = (found?.contacts || []).find((c) =>
            [c.phone, c.mobile].some((p) => String(p || '').replace(/\D/g, '').endsWith(tail))
        )
        if (match?.contact_id) return { id: String(match.contact_id), found: `phone ending ${tail}` }
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
    return { id: String(created?.contact?.contact_id ?? ''), found: 'created a new contact' }
}

/**
 * The Books currency id for naira, remembered once.
 *
 * Looked up rather than configured: a currency id is per-organisation, so a
 * hard-coded one is correct until the day the org changes and then silently
 * posts every invoice in the wrong currency.
 */
let nairaIdCache = null
const nairaCurrencyId = async () => {
    if (nairaIdCache !== null) return nairaIdCache
    const body = await zoho.call('get', 'settings/currencies', { books: true })
    const ngn = (body?.currencies || []).find((c) => str(c.currency_code).toUpperCase() === 'NGN')
    nairaIdCache = ngn?.currency_id ? String(ngn.currency_id) : null
    return nairaIdCache
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
        const contact = await contactFor(customer)
        if (!contact?.id) return { skipped: 'could not resolve a Books contact' }
        const contactId = contact.id

        const currency = str(shipment.currency).toUpperCase() || 'NGN'
        const today = new Date().toISOString().slice(0, 10)

        /* Raise the invoice in the currency the delivery was actually sold in,
           rather than converting first.
        
           The books are kept in USD, so the temptation is to divide by a rate
           and post dollars. Two things make that worse than it looks: Zoho
           quotes NGN as 0.000714, which is USD per naira — the inverse of the
           ~1400 the rest of this integration divides by — so getting the
           direction wrong produces a figure a million times out and still looks
           like a number. And a converted invoice records a rate that was true
           for one second, which is not what the customer was charged.
        
           Books is multi-currency. Handing it ₦26,400 and the NGN currency id
           lets it hold the sale at its real value and do its own conversion for
           the accounts, which is both more accurate and impossible to invert. */
        const currencyId = await nairaCurrencyId().catch(() => null)
        const amount = feeNgn
        const postedIn = currency === 'NGN' && currencyId ? 'NGN' : 'USD (org default)'

        const invoice = await zoho.call('post', 'invoices', {
            books: true,
            params: { ignore_auto_number_generation: true },
            data: {
                customer_id: contactId,
                ...(currency === 'NGN' && currencyId ? { currency_id: currencyId } : {}),
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
            posted_in: postedIn,
            billed_to: customer.email || customer.phone || customer.name,
            contact_matched_by: contact.found,
            amount_ngn: feeNgn,
            at: new Date().toISOString(),
        }
        await shipment.update({ metadata: { ...(shipment.metadata || {}), books_invoice: record } }).catch(() => {})

        console.log(
            `[BOOKS INVOICE] ${shipment.shipment_reference} → ${created.invoice_number} ` +
                `(${amount} ${postedIn})`
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
