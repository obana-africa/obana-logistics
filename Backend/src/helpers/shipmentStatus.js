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
    pending: 'Created',
    confirmed: 'Created',
    picked_up: 'Shipped',
    dispatched: 'Shipped',
    in_transit: 'Shipped',
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

module.exports = { DISPLAY, displayStatus }
