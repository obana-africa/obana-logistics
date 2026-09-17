/**
 * What a shipment's status is called outside Obana.
 *
 * Obana tracks a parcel in more detail than anyone reading an order needs:
 * picked up, dispatched and in transit are three things to a dispatcher and one
 * thing to a customer. Zoho's own lifecycle is created, shipped, delivered, and
 * a parcel should not be "confirmed" on one screen and "Created" on another —
 * so every surface shows the same three words.
 *
 * The raw status is untouched. Drivers, agents and the rest of the platform
 * keep running on it; this is only what gets displayed.
 */
const DISPLAY = {
    pending: 'Package Created',
    confirmed: 'Package Created',
    picked_up: 'In Transit',
    dispatched: 'In Transit',
    in_transit: 'In Transit',
    delivered: 'Fulfilled',
    failed: 'Failed',
    cancelled: 'Cancelled',
    returned: 'Returned'
}

/** Title-cases anything unrecognised rather than showing a raw enum. */
const displayStatus = (status) => {
    const key = String(status || '').trim().toLowerCase()
    return DISPLAY[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || null
}

/**
 * The link a customer follows to track a parcel.
 *
 * There is no /track/<ref> page — the site reads ?track= on the home page and
 * opens tracking from there, which is what the emails and WhatsApp messages
 * have always sent. A path-style link 404s, and it had been going into Zoho on
 * every order.
 */
const trackingUrl = (reference) =>
    `${process.env.FRONTEND_URL || 'https://logistics.obana.africa'}/?track=${encodeURIComponent(reference)}`

module.exports = { DISPLAY, displayStatus, trackingUrl }
