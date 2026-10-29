const path = require('node:path')
const fs = require('node:fs')
const PDFDocument = require('pdfkit')

/**
 * The shipment summary Obana issues, as a PDF.
 *
 * Generated here rather than in the browser because this is the copy that gets
 * kept: it is uploaded with the shipment and it is what the link in a WhatsApp
 * message opens. A document the customer can produce is a convenience; one we
 * issue and store is a record, and the two should not be able to disagree.
 *
 * Laid out as a receipt — who it is from, what is being moved, what it costs,
 * and how to pay — because that is what it is used as.
 */

const LOGO = path.join(__dirname, '..', 'assets', 'obana-logo.png')

/* The confirm screen's palette, so the document somebody downloads is the one
   they were just looking at rather than a second design of the same facts.
   Tailwind's values, named for what they are used on. */
const NAVY = '#1b3b5f'
const INK = '#111827'          /* gray-900  — values */
const MUTED = '#4b5563'        /* gray-600  — labels */
const FAINT = '#6b7280'        /* gray-500  — notes */
const RULE = '#e5e7eb'         /* gray-200  — borders */
const BLUE = '#2563eb'         /* blue-600  — the shipment card's mark */
const BLUE_EDGE = '#bfdbfe'    /* blue-200  — its border and inner rules */
const BLUE_WASH = '#eff6ff'    /* blue-50   — its gradient, left */
const PURPLE_WASH = '#faf5ff'  /* purple-50 — its gradient, right */
const PICKUP_WASH = '#f5f9ff'  /* blue-50/30   — the pickup card */
const GREEN = '#16a34a'        /* green-600 — the rate, and delivery */
const DELIVERY_WASH = '#f4fdf7' /* green-50/30 — the delivery card */
const PURPLE = '#9333ea'       /* purple-600 — items */
const ITEMS_WASH = '#fcfaff'   /* purple-50/30 — the items card */

/* The footer, as Obana writes it. */
/* The footer, as Obana writes it — and each thing it names is a link, so a
   customer holding the document can reach the one they need without typing
   anything. Thaja says what it is in brackets: the name on its own tells a
   first-time reader nothing. */
const FOOTER = [
    { text: 'www.obana.africa', url: 'https://obana.africa' },
    { text: ' \u2014 One Platform Powering your Business. ' },
    { text: 'Marketplace', url: 'https://marketplace.obana.africa' },
    { text: ' | ' },
    { text: 'Financing', url: 'https://marketplace.obana.africa/obana-pss' },
    { text: ' | ' },
    { text: 'Logistics', url: 'https://logistics.obana.africa' },
    { text: ' | ' },
    { text: 'Thaja (POS/Webshop)', url: 'https://thaja.africa' }
]

/** The same line as plain words, for anywhere that cannot carry a link. */
const TAGLINE = FOOTER.map((part) => part.text).join('')

/* Where payment goes. On every summary, which is the point of a payment
   footer; overridable per environment only if that ever has to differ. */
const ACCOUNTS = [
    { name: 'Icon Tech & Ecommerce Service Limited', bank: 'Sterling Bank', number: '0118874437', currency: 'NGN' },
    { name: 'Icon Tech & Ecommerce Service Limited', bank: 'Carbon MicroFinance Bank', number: '9932489664', currency: 'NGN' }
]

/**
 * Text a PDF's standard fonts can actually draw.
 *
 * Helvetica and its siblings are encoded WinAnsi, which has no naira sign and
 * no arrow: the first printed as a stray colon and the second as "!'" — in the
 * middle of a route, on a document sent to a customer. Embedding a Unicode
 * font would fix the glyphs and add the better part of a megabyte to the
 * service for two characters, so the two are spelt instead. Everything else a
 * Latin address needs — accents, dashes, the middle dot — WinAnsi already has.
 */
const SUBSTITUTES = [
    [/\u20a6\s?/g, 'NGN '],
    [/\s*(\u2192|\u2794|\u27a1)\s*/g, ' to ']
]

const printable = (value) => {
    let text = String(value ?? '')
    for (const [pattern, replacement] of SUBSTITUTES) text = text.replace(pattern, replacement)
    /* Anything still outside Latin-1 would draw as a blank or the wrong glyph;
       dropping it is less confusing than printing nonsense. */
    return text.replace(/[^\u0000-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u00b7]/g, '')
}

const str = (v) => printable(v).trim()

/** "NGN 2,373,313.00" — spelt out, because the symbol has no glyph here. */
const money = (amount, currency = 'NGN') => {
    const value = Number(amount || 0)
    const figure = value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${str(currency).toUpperCase() || 'NGN'} ${figure}`
}

/**
 * A phone number with its country code visible.
 *
 * Stored as entered, so an international number arrives as "39445858835" and
 * reads like a local one with an odd prefix. The + is what says which country
 * it belongs to — and it is not added to a number starting with 0, which is a
 * national number with its trunk code: "+08090335245" is not a phone number
 * anywhere.
 */
const showPhone = (phone) => {
    const value = str(phone)
    if (!value) return ''
    return /^\d{10,15}$/.test(value) && !value.startsWith('0') ? `+${value}` : value
}

const placeLines = (address) =>
    [
        str(address?.name) || [str(address?.first_name), str(address?.last_name)].filter(Boolean).join(' '),
        str(address?.line1),
        str(address?.line2),
        [str(address?.city), str(address?.state)].filter(Boolean).join(', '),
        str(address?.country),
        showPhone(address?.phone)
    ].filter(Boolean)

/**
 * One row of the charges table. Kept as a helper because the total needs the
 * same columns as the lines above it or the figures do not line up.
 */
const chargeRow = (doc, left, right, { bold = false, rule = true, top } = {}) => {
    const y = top ?? doc.y
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor(bold ? INK : MUTED)
    doc.text(left, 48, y, { width: 300 })
    doc.fillColor(INK).text(right, 348, y, { width: 199, align: 'right' })
    const bottom = doc.y + 6
    if (rule) {
        doc.moveTo(48, bottom).lineTo(547, bottom).lineWidth(bold ? 1 : 0.5).strokeColor(bold ? NAVY : RULE).stroke()
    }
    doc.y = bottom + 8
    return doc.y
}

const sectionHeading = (doc, text) => {
    doc.moveDown(0.4)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(String(text).toUpperCase(), 48, doc.y, { characterSpacing: 1.1 })
    doc.moveDown(0.35)
}

/* ── The furniture the confirm screen is built from ─────────────────────────
 
   Three cards, in the order they appear on screen: the shipment and what it
   costs, the two addresses, then what is in the box. Each is a rounded panel
   with a wash behind it and a coloured mark against its heading, because that
   is what somebody is holding this against — the page they read ten seconds
   ago.
 
   Heights are measured before anything is drawn. A panel has to be painted
   before the text that sits on it, or it covers it, and there is no way to
   reach back up a PDF once it has been written. */

const CARD_X = 48
const CARD_W = 499
const PAD = 14
const INNER_X = CARD_X + PAD
const INNER_W = CARD_W - PAD * 2
const COL_W = Math.floor((INNER_W - 16) / 2)
const COL2_X = INNER_X + COL_W + 16

const heightOf = (doc, text, { font = 'Helvetica', size = 10, width = INNER_W } = {}) => {
    doc.font(font).fontSize(size)
    return doc.heightOfString(String(text ?? ''), { width })
}

/** A panel: one wash, one border, the same 8pt corner as on screen. */
const panel = (doc, y, height, { fill, stroke = RULE, gradient } = {}) => {
    const paint = gradient
        ? doc.linearGradient(CARD_X, y, CARD_X + CARD_W, y).stop(0, gradient[0]).stop(1, gradient[1])
        : fill
    doc.roundedRect(CARD_X, y, CARD_W, height, 8).lineWidth(1).fillAndStroke(paint, stroke)
    doc.fillColor(INK)
}

/* The marks beside each heading. Drawn rather than set, because the page uses
   icons and a PDF's standard fonts have none — a lorry, a pin and a carton in
   a dozen points each, which is all they have to read as at this size. */
const truckMark = (doc, x, y, color) => {
    doc.save().fillColor(color).strokeColor(color).lineWidth(1)
    doc.roundedRect(x, y + 2.5, 8, 6, 1).fill()
    doc.moveTo(x + 8.8, y + 4.5).lineTo(x + 11.4, y + 4.5).lineTo(x + 13, y + 6.4).lineTo(x + 13, y + 8.5).lineTo(x + 8.8, y + 8.5).closePath().fill()
    doc.fillColor('#ffffff').circle(x + 3.2, y + 10.4, 2.1).fill()
    doc.fillColor('#ffffff').circle(x + 10.6, y + 10.4, 2.1).fill()
    doc.fillColor(color).circle(x + 3.2, y + 10.4, 1.4).fill()
    doc.fillColor(color).circle(x + 10.6, y + 10.4, 1.4).fill()
    doc.restore()
}

const pinMark = (doc, x, y, color) => {
    doc.save().fillColor(color)
    doc.circle(x + 5, y + 4.5, 4.2).fill()
    doc.moveTo(x + 1.6, y + 7).lineTo(x + 8.4, y + 7).lineTo(x + 5, y + 12).closePath().fill()
    doc.fillColor('#ffffff').circle(x + 5, y + 4.5, 1.5).fill()
    doc.restore()
}

const boxMark = (doc, x, y, color) => {
    doc.save().strokeColor(color).fillColor(color).lineWidth(1)
    doc.rect(x + 0.5, y + 2.5, 11, 9).stroke()
    doc.moveTo(x + 0.5, y + 5.5).lineTo(x + 11.5, y + 5.5).stroke()
    doc.rect(x + 4.5, y + 2.5, 3, 3).fill()
    doc.restore()
}

/** A card heading: the mark, then the words, as on screen. */
const cardHeading = (doc, y, mark, color, text) => {
    mark(doc, INNER_X, y, color)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(str(text), INNER_X + 19, y + 1, { width: INNER_W - 19 })
    return y + 20
}

/** One label-over-value cell out of the grid on the confirm screen. */
const cell = (doc, x, y, width, label, value, { color = INK, size = 10, bold = true } = {}) => {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(str(label), x, y, { width })
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
    doc.text(str(value) || '—', x, y + 12, { width })
    return doc.y
}

const cellHeight = (doc, label, value, { size = 10, width = COL_W } = {}) =>
    12 + heightOf(doc, str(value) || '—', { font: 'Helvetica-Bold', size, width })

/* The route, written the way the screen writes it: one line per leg, each
   named, because "Villaverla to Port Harcourt" over a consignment that clears
   in Ikeja and travels on says nothing about the half charged for separately
   below. */
const routeLines = (summary) => {
    const legs = Array.isArray(summary.legs) ? summary.legs : []
    if (legs.length > 1) {
        return legs.map((leg) => ({
            tag: leg.kind === 'local' ? 'Last mile' : 'Freight',
            text: [str(leg.from), str(leg.to)].filter(Boolean).join(' to ')
        }))
    }
    return [{ tag: '', text: str(summary.route) }]
}

/* How tall the route will actually be. Counting a line per leg was close
   enough until a route with the countries on it wrapped, and then the rows
   underneath sat on top of it. */
const routeHeight = (doc, lines) =>
    lines.reduce(
        (sum, line) => sum + heightOf(doc, line.text, { font: 'Helvetica-Bold', size: 10, width: COL_W - (line.tag ? 44 : 0) }),
        0
    )

/**
 * Build the PDF and hand back the bytes.
 *
 * @param {Object} summary
 * @param {string} summary.reference        OBN-… , the tracking number
 * @param {string} [summary.awbNumber]      Printed only when there is one
 * @param {string} summary.route
 * @param {string} summary.service
 * @param {string} [summary.eta]            Printed only when there is one
 * @param {string} [summary.rate]           The rate per kilo, at the top as on screen
 * @param {string} [summary.pieces]         How many items, when there is a count
 * @param {string} [summary.conversionNote] The rate, printed under the charges
 * @param {string} summary.weight
 * @param {Array}  summary.charges          [{ label, value, strong }]
 * @param {Object} summary.pickup           address
 * @param {Object} summary.delivery         address
 * @param {Array}  [summary.items]          [{ name, weight, value }]
 * @param {string} [summary.trackingUrl]
 * @param {string} [summary.issuedAt]
 */
const buildShipmentSummaryPdf = (summary) =>
    new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 48 })
            const chunks = []
            doc.on('data', (c) => chunks.push(c))
            doc.on('end', () => resolve(Buffer.concat(chunks)))
            doc.on('error', reject)

            /* ── Header: who it is from, and which shipment ───────────────── */
            if (fs.existsSync(LOGO)) {
                doc.image(LOGO, 48, 44, { width: 104 })
            } else {
                doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text('obana', 48, 48)
            }

            const issued = summary.issuedAt ? new Date(summary.issuedAt) : new Date()
            doc.font('Helvetica').fontSize(9).fillColor(MUTED)
            doc.text('SHIPMENT SUMMARY', 348, 46, { width: 199, align: 'right', characterSpacing: 1.1 })
            doc.font('Helvetica-Bold').fontSize(13).fillColor(INK)
            doc.text(str(summary.reference) || '—', 348, 60, { width: 199, align: 'right' })
            doc.font('Helvetica').fontSize(9).fillColor(MUTED)
            doc.text(issued.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 348, 78, {
                width: 199,
                align: 'right'
            })

            doc.moveTo(48, 112).lineTo(547, 112).lineWidth(2).strokeColor(NAVY).stroke()
            let y = 130

            /* ── The shipment, and what it costs ──────────────────────────
            
               The card the confirm screen opens with, in the same order and
               the same colours: the facts in two columns, then the breakdown
               under a rule, then the rate it was converted at. */
            const lines = routeLines(summary)
            const routeH = routeHeight(doc, lines)

            const facts = [
                { label: 'Route', route: true },
                { label: 'Service', value: summary.service },
                /* Directly under the service, because the service decides it.
                   "Confirmed after booking" rather than a guess: a date on a
                   document is read as a promise. */
                { label: 'Estimated arrival', value: str(summary.eta) || 'Confirmed after booking' },
                { label: 'Total weight', value: summary.weight }
            ]
            /* The rate, not the total — the figure a customer can hold against
               another forwarder's. Green and larger, as on screen. The total is
               the last line of the breakdown below, where a total belongs. */
            if (str(summary.rate)) facts.push({ label: 'Shipping rate / kilo', value: summary.rate, color: GREEN, size: 13 })
            if (str(summary.pieces)) facts.push({ label: 'Number of pieces', value: summary.pieces })
            if (str(summary.awbNumber)) facts.push({ label: 'Air waybill', value: summary.awbNumber })

            /* Measure the grid before painting anything behind it. */
            const rows = []
            for (let i = 0; i < facts.length; i += 2) {
                const pair = facts.slice(i, i + 2)
                const height = Math.max(
                    ...pair.map((f) => (f.route ? 12 + routeH : cellHeight(doc, f.label, f.value, { size: f.size })))
                )
                rows.push({ pair, height })
            }
            const gridH = rows.reduce((sum, r) => sum + r.height + 10, 0)

            const charges = summary.charges || []
            const chargesH = charges.length ? 10 + charges.length * 15 : 0
            const noteH = str(summary.conversionNote)
                ? 4 + heightOf(doc, str(summary.conversionNote), { size: 8, width: INNER_W })
                : 0
            const trackH = str(summary.trackingUrl) ? 16 : 0
            const cardH = 20 + gridH + chargesH + noteH + trackH + PAD + 4

            panel(doc, y, cardH, { gradient: [BLUE_WASH, PURPLE_WASH], stroke: BLUE_EDGE })
            let cy = cardHeading(doc, y + PAD, truckMark, BLUE, 'Shipment Summary')

            for (const row of rows) {
                row.pair.forEach((fact, index) => {
                    const x = index === 0 ? INNER_X : COL2_X
                    if (fact.route) {
                        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Route', x, cy, { width: COL_W })
                        let ry = cy + 12
                        for (const line of lines) {
                            let tx = x
                            if (line.tag) {
                                doc.font('Helvetica').fontSize(8).fillColor(FAINT).text(line.tag, tx, ry + 1, { width: 42 })
                                tx += 44
                            }
                            doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(line.text, tx, ry, { width: COL_W - (tx - x) })
                            ry = doc.y
                        }
                    } else {
                        cell(doc, x, cy, COL_W, fact.label, fact.value, { color: fact.color, size: fact.size })
                    }
                })
                cy += row.height + 10
            }

            /* What the total is made of, under the same faint blue rule the
               screen draws it under. */
            if (charges.length) {
                doc.moveTo(INNER_X, cy).lineTo(INNER_X + INNER_W, cy).lineWidth(0.7).strokeColor(BLUE_EDGE).stroke()
                cy += 9
                charges.forEach((line) => {
                    const strong = Boolean(line.strong)
                    if (strong) {
                        doc.moveTo(INNER_X, cy - 3).lineTo(INNER_X + INNER_W, cy - 3).lineWidth(0.7).strokeColor(BLUE_EDGE).stroke()
                    }
                    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(strong ? INK : MUTED)
                    doc.text(str(line.label), INNER_X, cy, { width: INNER_W - 170 })
                    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK)
                    doc.text(str(line.value), INNER_X + INNER_W - 170, cy, { width: 170, align: 'right' })
                    cy += 15
                })
            }

            if (noteH) {
                doc.font('Helvetica').fontSize(8).fillColor(FAINT).text(str(summary.conversionNote), INNER_X, cy, { width: INNER_W })
                cy += noteH
            }
            if (trackH) {
                doc.font('Helvetica').fontSize(8).fillColor(FAINT).text(`Track: ${str(summary.trackingUrl)}`, INNER_X, cy + 4, { width: INNER_W })
            }

            y += cardH + 12

            /* ── Where it goes ────────────────────────────────────────────
            
               Two cards side by side, pickup in blue and delivery in green,
               exactly as the pair sits on the confirm screen. */
            const half = Math.floor((CARD_W - 12) / 2)
            const sides = [
                { title: 'Pickup Address', lines: placeLines(summary.pickup), wash: PICKUP_WASH, color: BLUE, x: CARD_X },
                { title: 'Delivery Address', lines: placeLines(summary.delivery), wash: DELIVERY_WASH, color: GREEN, x: CARD_X + half + 12 }
            ]
            const sideH = 20 + PAD * 2 + Math.max(
                ...sides.map((side) =>
                    side.lines.reduce((sum, line) => sum + heightOf(doc, line, { width: half - PAD * 2 }), 0)
                )
            )
            for (const side of sides) {
                doc.roundedRect(side.x, y, half, sideH, 8).lineWidth(1).fillAndStroke(side.wash, RULE)
                pinMark(doc, side.x + PAD, y + PAD, side.color)
                doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(side.title, side.x + PAD + 17, y + PAD + 1, { width: half - PAD * 2 - 17 })
                let ly = y + PAD + 20
                side.lines.forEach((line, index) => {
                    doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(index === 0 ? INK : MUTED)
                    doc.text(line, side.x + PAD, ly, { width: half - PAD * 2 })
                    ly = doc.y
                })
            }
            y += sideH + 12

            /* ── What is in the box ───────────────────────────────────────── */
            const items = (summary.items || []).filter((i) => str(i.name))
            if (items.length) {
                const rowH = 26
                const itemsH = 20 + PAD * 2 + items.length * rowH
                doc.roundedRect(CARD_X, y, CARD_W, itemsH, 8).lineWidth(1).fillAndStroke(ITEMS_WASH, RULE)
                let iy = cardHeading(doc, y + PAD, boxMark, PURPLE, `Items (${items.length})`)
                items.forEach((item, index) => {
                    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(str(item.name), INNER_X, iy, { width: INNER_W - 190 })
                    doc.font('Helvetica').fontSize(8).fillColor(FAINT).text(`${str(item.weight)} each`, INNER_X, iy + 12, { width: INNER_W - 190 })
                    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(str(item.weight), INNER_X + INNER_W - 190, iy, { width: 190, align: 'right' })
                    /* Blank rather than NGN 0.00: an unstated value is not a
                       worthless parcel. */
                    if (str(item.value)) {
                        doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`${str(item.value)} each`, INNER_X + INNER_W - 190, iy + 12, { width: 190, align: 'right' })
                    }
                    if (index < items.length - 1) {
                        doc.moveTo(INNER_X, iy + rowH - 5).lineTo(INNER_X + INNER_W, iy + rowH - 5).lineWidth(0.5).strokeColor(RULE).stroke()
                    }
                    iy += rowH
                })
                y += itemsH + 12
            }

            doc.y = y

            /* ── How to pay, and who we are ──────────────────────────────── */
            /* The payment block sits at the foot of the page, and goes to a
               second one rather than off the bottom when the goods ran long. */
            /* The block needs about seventy points, and the tagline sits at
               782. Anything above that fits on this page. */
            if (doc.y > 698) doc.addPage()
            const footerTop = Math.max(doc.y + 14, 690)
            doc.y = footerTop
            doc.moveTo(48, footerTop).lineTo(547, footerTop).lineWidth(0.5).strokeColor(RULE).stroke()
            doc.y = footerTop + 12

            sectionHeading(doc, 'Payment')
            const accountsTop = doc.y
            ACCOUNTS.forEach((account, i) => {
                const x = i === 0 ? 48 : 303
                doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(account.name, x, accountsTop, { width: 244 })
                doc.font('Helvetica').fontSize(10).fillColor(MUTED)
                doc.text(account.bank, x, doc.y, { width: 244 })
                doc.font('Helvetica-Bold').fillColor(INK).text(`${account.number}  (${account.currency})`, x, doc.y, { width: 244 })
            })

            /* Laid out a piece at a time rather than as one centred string:
               a link has to be given the box it occupies, and that means
               knowing where each word starts. Widths are measured first so the
               whole line still sits in the middle of the page. */
            doc.font('Helvetica').fontSize(8)
            const widths = FOOTER.map((part) => doc.widthOfString(printable(part.text)))
            let fx = 48 + (499 - widths.reduce((a, b) => a + b, 0)) / 2
            FOOTER.forEach((part, i) => {
                const text = printable(part.text)
                doc.fillColor(part.url ? NAVY : MUTED)
                doc.text(text, fx, 782, { lineBreak: false, link: part.url || null, underline: Boolean(part.url) })
                fx += widths[i]
            })

            doc.end()
        } catch (error) {
            reject(error)
        }
    })

module.exports = { buildShipmentSummaryPdf, money, placeLines, ACCOUNTS, TAGLINE, FOOTER }
