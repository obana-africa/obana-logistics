const { money } = require('./shipmentSummaryDocument')
const { quoteCurrency } = require('./currencyRates')

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

    /* Quoted in the shipper's money, converted into the receiver's.
    
       The base is the local currency where the goods are picked up. That is
       what the person paying thinks in and what they will hold against another
       forwarder's quote; a sender in Italy given a naira figure has to go and
       find a rate before they can tell whether it is a good price, and the
       rate they find will not be ours.
    
       The naira stays beside it, because naira is what is actually charged and
       what reaches the books. Base first, charged second.
    
       Both ends must be known. An unknown country is not a reason to quote a
       conversion nobody asked for, and it would silently default to Nigeria. */
    const from = countryCodeOf ? countryCodeOf(pickup) : ''
    const to = countryCodeOf ? countryCodeOf(delivery) : ''
    const crossBorder = Boolean(from && to && from !== to)

    /* The shipper's own money, with the dollar as the stand-in if no rate can
       be had for it, and naira alone only when neither can. */
    const quote = crossBorder ? await quoteCurrency(from, to) : { code: currency, nairaPerUnit: 0 }
    const baseCode = quote.code
    const perBase = baseCode === currency ? 0 : quote.nairaPerUnit
    const converts = perBase > 0

    /* One figure, several spellings: the number itself, the way a page or a
       document writes it, and the way a WhatsApp variable has to — KudiSMS
       splits its parameters field on commas, so that one is grouped with
       spaces. Never a different number. */
    const figure = (amount) => {
        const naira = Number(amount) || 0
        const charged = money(naira, currency)
        const chargedPlain = plainMoney(naira, currency)
        if (!converts) {
            return { amount: naira, base: null, display: charged, plain: chargedPlain }
        }
        const inBase = naira / perBase
        return {
            amount: naira,
            base: money(inBase, baseCode),
            baseAmount: inBase,
            display: `${money(inBase, baseCode)} (${charged})`,
            plain: `${plainMoney(inBase, baseCode)} (${chargedPlain})`
        }
    }

    /* The rates divide the delivery, not the total: the service charge is on
       the job, not on each kilo or each carton, and mixing them would state a
       rate nobody quoted. */
    /* The breakdown says each thing once.
    
       The rate per kilo is not here: it leads the block above, and a figure
       repeated a few lines below itself reads as two different charges. The
       rate per unit stays, because nothing else states it.
    
       No counts in the labels either — the weight and the number of pieces are
       both above — and no percentage on the handling charge. What the customer
       owes is the amount; the percentage it was worked out from is our
       arithmetic, not their bill. */
    const lines = []
    if (units > 1) lines.push({ key: 'rate_per_unit', label: 'Rate per unit', ...figure(deliveryPart / units) })
    if (serviceCharge > 0) {
        lines.push({ key: 'delivery', label: 'Total Freight Charge', ...figure(deliveryPart) })
        lines.push({ key: 'service_charge', label: 'Handling/Service Charge', ...figure(serviceCharge) })
        lines.push({ key: 'total', label: 'Total', strong: true, ...figure(total) })
    } else {
        lines.push({ key: 'total', label: 'Shipping cost', strong: true, ...figure(total) })
    }

    /* Still worked out, because the block above prints it and the WhatsApp
       message carries it — it is simply no longer a line in the breakdown. */
    const perKiloFigure = weight > 0 ? { key: 'rate_per_kg', label: 'Rate per kg', ...figure(deliveryPart / weight) } : null

    const by = (key) => (key === 'rate_per_kg' ? perKiloFigure : lines.find((l) => l.key === key) ?? null)

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
        /* "Number of pieces" on the invoice they compared us against. Only
           when there is a real count behind it. */
        pieces: units > 0 ? String(units) : '',
        currency,
        crossBorder,
        /* The shipper's currency, the rate it was converted at, and that rate
           as a sentence — a converted figure with no rate beside it is a
           number nobody can check. */
        baseCurrency: converts ? baseCode : currency,
        conversionRate: converts ? perBase : null,
        conversionNote: converts ? `Converted at ${money(1, baseCode)} = ${money(perBase, currency)}` : '',
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
