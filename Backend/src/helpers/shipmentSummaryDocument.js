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

const NAVY = '#1b3b5f'
const INK = '#1f2937'
const MUTED = '#64748b'
const RULE = '#e5e7eb'

/* The footer, as Obana writes it. */
const TAGLINE = 'www.obana.africa — One Platform Powering your Business. Marketplace | Financing | Logistics | Thaja'

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

/**
 * Build the PDF and hand back the bytes.
 *
 * @param {Object} summary
 * @param {string} summary.reference        OBN-… , the tracking number
 * @param {string} [summary.awbNumber]      Printed only when there is one
 * @param {string} summary.route
 * @param {string} summary.service
 * @param {string} [summary.eta]            Printed only when there is one
 * @param {string} [summary.cost]           The total, at the top as on screen
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
            doc.y = 128

            /* ── What is being moved ──────────────────────────────────────── */
            sectionHeading(doc, 'Shipment')
            const facts = [
                ['Route', str(summary.route)],
                ['Service', str(summary.service)]
            ]
            /* Directly under the service, because it is the service that
               decides it: economy and express are the same parcel on the same
               lane, and the only thing a customer is choosing between is how
               long it takes. Left out rather than guessed at when nothing was
               recorded — a date on a document is read as a promise. */
            if (str(summary.eta)) facts.push(['Estimated arrival', str(summary.eta)])
            facts.push(['Total weight', str(summary.weight)])
            /* How many things are in the consignment, which is the first thing
               the forwarder's own invoice states. Only when there is a real
               count behind it. */
            if (str(summary.pieces)) facts.push(['Number of pieces', str(summary.pieces)])
            if (str(summary.awbNumber)) facts.push(['Air waybill', str(summary.awbNumber)])
            /* The figure, at the top, where the screen puts it.
            
               Somebody reading this has usually just seen the same shipment on
               the confirm page, and the first thing they look for is the one
               they remember. Finding it only at the foot of a table reads as a
               different document about a different shipment. It is repeated at
               the foot as the total of the breakdown, which is what a
               breakdown is for. */
            if (str(summary.cost)) facts.push(['Shipping cost', str(summary.cost), true])
            if (str(summary.trackingUrl)) facts.push(['Track', str(summary.trackingUrl)])

            for (const [label, value, strong] of facts) {
                const y = doc.y
                doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, 48, y, { width: 120 })
                doc.font('Helvetica-Bold').fontSize(strong ? 12 : 10).fillColor(INK).text(value, 168, y, { width: 379 })
                doc.y += strong ? 6 : 4
            }

            /* ── What it costs ────────────────────────────────────────────── */
            sectionHeading(doc, 'Charges')
            for (const line of summary.charges || []) {
                chargeRow(doc, str(line.label), str(line.value), { bold: Boolean(line.strong) })
            }
            /* The rate the conversion was done at. A figure in one currency
               with the charge in another beside it, and no rate between them,
               is a number the reader cannot check — and checking it is the
               whole reason the shipper's currency is on here. */
            if (str(summary.conversionNote)) {
                doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(str(summary.conversionNote), 48, doc.y, { width: 499 })
                doc.y += 6
            }

            /* ── Where it goes ────────────────────────────────────────────── */
            sectionHeading(doc, 'Addresses')
            const top = doc.y
            const columns = [
                ['Pickup', placeLines(summary.pickup), 48],
                ['Delivery', placeLines(summary.delivery), 303]
            ]
            let lowest = top
            for (const [title, lines, x] of columns) {
                doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(title.toUpperCase(), x, top, { characterSpacing: 1 })
                doc.font('Helvetica').fontSize(10).fillColor(INK)
                let y = doc.y + 2
                for (const line of lines) {
                    doc.text(line, x, y, { width: 244 })
                    y = doc.y
                }
                lowest = Math.max(lowest, y)
            }
            doc.y = lowest + 6

            /* ── What is in the box, when it was said ─────────────────────── */
            const items = (summary.items || []).filter((i) => str(i.name))
            if (items.length) {
                sectionHeading(doc, 'Items')
                const head = doc.y
                doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
                doc.text('DESCRIPTION', 48, head, { width: 300 })
                doc.text('WEIGHT', 348, head, { width: 95, align: 'right' })
                doc.text('VALUE', 452, head, { width: 95, align: 'right' })
                doc.moveTo(48, doc.y + 4).lineTo(547, doc.y + 4).lineWidth(0.5).strokeColor(RULE).stroke()
                doc.y += 10
                for (const item of items) {
                    const y = doc.y
                    doc.font('Helvetica').fontSize(10).fillColor(INK)
                    doc.text(str(item.name), 48, y, { width: 300 })
                    const afterName = doc.y
                    doc.text(str(item.weight), 348, y, { width: 95, align: 'right' })
                    doc.text(str(item.value) || '—', 452, y, { width: 95, align: 'right' })
                    doc.y = Math.max(afterName, doc.y) + 4
                }
            }

            /* ── How to pay, and who we are ──────────────────────────────── */
            const footerTop = Math.max(doc.y + 18, 620)
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

            doc.font('Helvetica').fontSize(8).fillColor(MUTED)
            doc.text(TAGLINE, 48, 782, { width: 499, align: 'center' })

            doc.end()
        } catch (error) {
            reject(error)
        }
    })

module.exports = { buildShipmentSummaryPdf, money, placeLines, ACCOUNTS, TAGLINE }
