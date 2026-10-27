const { money } = require('./shipmentSummaryDocument')
const { nairaPerUsd, inUsd } = require('./usdRate')

/**
 * What a shipment says about itself — once, for every surface that says it.
 *
 * The page, the PDF and the WhatsApp message were each working the same
 * figures out from the shipment in their own way, and they drifted: the rate
 * per kg reached the document but not the screen, the arrival window reached
 * the message but not the paper, and the dollars reached none of them until
 * last week. A customer who compares the three finds three answers, and the
 * one they quote back is whichever is worst for us.
 *
 * So the figures are worked out here and nowhere else. A surface renders this;
 * it does not compute. Adding a line means adding it once, and it appears in
 * all three.
 *
 * The only thing a surface is allowed to differ on is punctuation, because
 * KudiSMS splits its parameters field on commas and a WhatsApp variable
 * therefore cannot contain one. Hence `plain` beside `display` on every
 * figure: the same number, grouped with spaces instead. Never a different
 * number.
 */

/** "Alberton, Gauteng (South Africa)" — the country included, because an international shipment that reads as a local one is the thing people query. */
const placeOf = (address) =>
    [address?.city, address?.state].filter(Boolean).join(', ') + (address?.country ? ` (${address.country})` : '')

/** "₦7 500" with spaces for the digit groups, for a WhatsApp variable. */
const plainMoney = (amount, currency) => String(money(amount, currency)).replace(/,/g, ' ')

/**
 * The air waybill, from wherever it actually is.
 *
 * Nobody types one at booking — it does not exist yet. It arrives when the
 * forwarder issues it, which is when somebody types it on the shipment or
 * attaches the waybill with the number in the note beside it. So the number
 * kept on the shipment is read first, then the note, then the carrier
 * reference an external booking carries.
 */
const airWaybillOf = (shipment) => {
    const stored = String(shipment.awb_number ?? '').trim()
    if (stored) return stored
    const documents = Array.isArray(shipment.documents) ? shipment.documents : []
    const awb = documents.find((d) => String(d?.kind ?? '').trim().toUpperCase() === 'AWB')
    return String(awb?.note ?? '').trim() || String(shipment.external_carrier_reference ?? '').trim() || ''
}

/**
 * How long it takes: the window that was sold, and the dates it lands on.
 *
 * Both, because they answer different questions — the window is what was
 * agreed and can be held to, the dates are what the customer actually wants.
 * The string is whatever priced the shipment, kept on the shipment at creation
 * so this states the term the customer was shown rather than whatever the
 * route table says today.
 */
const transitOf = (shipment, deliveryTimeRange) => {
    const stated = String(shipment.metadata?.transit ?? shipment.metadata?.carrier_details?.delivery_time ?? '').trim()
    if (!stated) return ''
    const dates = String(deliveryTimeRange(stated) ?? '').trim()
    return dates && dates !== stated ? `${stated} (${dates})` : stated
}

/**
 * Build the summary.
 *
 * `countryCodeOf` and `deliveryTimeRange` are passed in rather than required,
 * because both live in controllers that require this file's neighbours and a
 * cycle here would be paid for at load time by the whole app.
 */
const buildShipmentSummary = async (shipment, { pickup, delivery, items = [], countryCodeOf, deliveryTimeRange } = {}) => {
    const currency = shipment.currency || 'NGN'
    const split = shipment.metadata?.fee_breakdown
    const weight = Number(shipment.total_weight) || 0
    const units = Number(shipment.total_items) || 0
    const total = Number(shipment.shipping_fee) || 0
    const deliveryPart = Number(split?.base ?? shipment.shipping_fee) || 0
    const serviceCharge = Number(split?.service_charge) || 0

    /* Dollars only where the shipment really crosses a border, and only where
       both countries are known: an unknown country is not a reason to quote a
       conversion nobody asked for. */
    const from = countryCodeOf ? countryCodeOf(pickup) : ''
    const to = countryCodeOf ? countryCodeOf(delivery) : ''
    const crossBorder = Boolean(from && to && from !== to)
    const perUsd = crossBorder ? await nairaPerUsd() : 0

    /* One figure, three spellings: the number itself, the way a page or a
       document writes it, and the way a WhatsApp variable has to. */
    const figure = (amount) => {
        const dollars = inUsd(amount, currency, perUsd)
        const display = money(amount, currency)
        const plain = plainMoney(amount, currency)
        return {
            amount: Number(amount) || 0,
            usd: dollars,
            display: dollars ? `${display} (${dollars})` : display,
            plain: dollars ? `${plain} (${dollars})` : plain
        }
    }

    /* The rates divide the delivery, not the total: the service charge is on
       the job, not on each kilo or each carton, and mixing them would state a
       rate nobody quoted. */
    const lines = []
    if (weight > 0) lines.push({ key: 'rate_per_kg', label: `Rate per kg (${weight} kg)`, ...figure(deliveryPart / weight) })
    /* Per unit only where there is more than one; on a single item it repeats
       the delivery line below it. */
    if (units > 1) lines.push({ key: 'rate_per_unit', label: `Rate per unit (${units} units)`, ...figure(deliveryPart / units) })
    if (serviceCharge > 0) {
        lines.push({ key: 'delivery', label: 'Delivery', ...figure(deliveryPart) })
        lines.push({ key: 'service_charge', label: split?.percent ? `${split.percent}% service charge` : 'Service charge', ...figure(serviceCharge) })
        lines.push({ key: 'total', label: 'Total', strong: true, ...figure(total) })
    } else {
        lines.push({ key: 'total', label: 'Shipping cost', strong: true, ...figure(total) })
    }

    const by = (key) => lines.find((l) => l.key === key) ?? null

    return {
        reference: shipment.shipment_reference,
        awbNumber: airWaybillOf(shipment),
        route: `${placeOf(pickup)} → ${placeOf(delivery)}`,
        from: placeOf(pickup),
        to: placeOf(delivery),
        service: [shipment.transport_mode, shipment.service_level].filter(Boolean).join(' · '),
        eta: deliveryTimeRange ? transitOf(shipment, deliveryTimeRange) : '',
        weight: `${weight.toFixed(2)} kg`,
        units,
        currency,
        crossBorder,
        usd_rate: perUsd || null,
        charges: lines,
        ratePerKg: by('rate_per_kg'),
        ratePerUnit: by('rate_per_unit'),
        deliveryCharge: by('delivery'),
        serviceCharge: by('service_charge'),
        total: by('total'),
        items: items.map((i) => ({
            name: i.name,
            weight: `${Number(i.weight) || 0} kg`,
            value: Number(i.total_price ?? i.price) > 0 ? money(i.total_price ?? i.price, currency) : ''
        }))
    }
}

module.exports = { buildShipmentSummary, placeOf, plainMoney, airWaybillOf }
