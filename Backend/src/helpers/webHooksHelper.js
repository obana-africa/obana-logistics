const crypto = require('crypto');
const db = require('../models/db.js')
const { Op } = require('sequelize')
const { sendRequest } = require('../helpers/sendRequestHelper')
const { validateRequest, getTenantAndEndpoint } = require('../helpers/requestValidator')

const userController = require('../controllers/userController'); // ADD THIS
const { flattenObj } = require('../../utils');
const utils = require('../../utils');
const e = require('cors');
const mailer = require('../mailer/nodemailer')
const WebhookController = require('../controllers/webhookController');



// Route service items are named/SKU'd with the "Ob-Log-" prefix (set by createTemplate).
const isRouteLineItem = (item) => {
    if (!item) return false
    const prefix = 'ob-log-'
    const name = String(item.name || '').trim().toLowerCase()
    const sku = String(item.sku || '').trim().toLowerCase()
    return name.startsWith(prefix) || sku.startsWith(prefix)
}

// Read a route item's custom field by LABEL (durable — Zoho freezes api_name at creation),
// with custom_field_hash fallback.
const getRouteItemCf = (item, label, hashKey) => {
    const arrays = [item.item_custom_fields, item.custom_fields].filter(Array.isArray)
    for (const arr of arrays) {
        const f = arr.find((x) => x.label === label)
        if (f && f.value !== undefined && f.value !== null && f.value !== '') return f.value
    }
    const hash = item.custom_field_hash || {}
    if (hashKey && hash[hashKey] !== undefined && hash[hashKey] !== null && hash[hashKey] !== '') {
        console.log(hash[hashKey])
        return hash[hashKey]
    }
    return null
}

// Parse a "City, State, Country" route field into an address with Obana fallbacks.
const buildRouteAddress = (locationStr, overrides = {}) => {
    const parts = String(locationStr || '').split(',').map((s) => s.trim())
    return {
        contact_name: overrides.contact_name || 'Obana Africa',
        phone: overrides.phone || '+2348090335245',
        email: overrides.email || 'obana.africa@gmail.com',
        line1: overrides.line1 || '77 Opebi Road',
        line2: overrides.line2 || '',
        city: parts[0] || 'Ikeja',
        state: parts[1] || 'Lagos',
        country: parts[2] || 'Nigeria',
        zip_code: overrides.zip_code || '100001'
    }
}

// Price by weight, keyed on the bracket's MAX weight (same formula as buildTemplateMatch):
//   totalWeight <= max -> route price; totalWeight > max -> price + (weight - max) * price / max.
const selectRouteBracket = (brackets, weight) => {
    if (!Array.isArray(brackets) || brackets.length === 0) return null
    const sortedByMax = [...brackets].sort((a, b) => Number(a.max || 0) - Number(b.max || 0))
    let bracket = sortedByMax.find((b) => weight <= Number(b.max || Number.POSITIVE_INFINITY))
    const isOverweight = !bracket
    if (!bracket) bracket = sortedByMax[sortedByMax.length - 1]
    const maxWeight = Number(bracket.max || 0)
    const basePrice = Number(bracket.price || 0)
    const result = { ...bracket }
    if (isOverweight && maxWeight > 0) {
        result.price = basePrice + ((weight - maxWeight) * basePrice) / maxWeight
        result.is_overweight = true
    } else {
        result.price = basePrice
    }
    return result
}

const normalizeZohoStatusValue = (value) => {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const findZohoPayloadValue = (node, keys) => {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findZohoPayloadValue(item, keys)
            if (found !== null && found !== undefined && found !== '') return found
        }
        return null
    }

    const lowerKeys = new Set(keys.map((key) => String(key).toLowerCase()))
    for (const [key, value] of Object.entries(node)) {
        if (lowerKeys.has(String(key).toLowerCase())) return value
        const nested = findZohoPayloadValue(value, keys)
        if (nested !== null && nested !== undefined && nested !== '') return nested
    }
    return null
}

class WeebHooksHelper {
    log
    constructor(endpoint, req, res, makeRequest) {
        this.endpoint = endpoint
        this.req = req
        this.res = res
        this.makeRequest = makeRequest
    }

    async callMethods() {
        const methodName = this.endpoint;
        this.log = await db.requests.create({
            originating_route: this.req.originalUrl,
            payload: JSON.stringify(this.req.body)
        })
        try {
            if (typeof this[methodName] === 'function') {
                return await this[methodName]();
            } else {
                throw new Error(`Method ${methodName} not found on WeebHooksHelper`);
            }
        } catch (error) {
            console.log(error.message)
            this.log.response = JSON.stringify(error)
            await this.log.save()
            return this.res.status(400).send(error.message)
        }
    }




    /**
     * Webhook entry for a manually-created Zoho salesorder carrying an "Ob-Log-" route item.
     * Reached via POST /requests/zohoSalesOrder. Handles the whole flow Zoho <-> logistics with
     * no Tajiri involvement: native shipment + Zoho package + Zoho shipment order + salesorder update.
     */
    zohoSalesOrder = async () => {
        const request = this.req.body
        const salesorder = request?.salesorder

        if (!salesorder || !Array.isArray(salesorder.line_items)) {
            return this.res.status(200).send(utils.responseSuccess({ skipped: true, reason: 'not a salesorder payload' }))
        }

        // Guard: act only on manual route orders. Shop/Tajiri orders carry cf_meta_data and no route item.
        const cfHash = salesorder.custom_field_hash || {}
        const metaRaw = cfHash.cf_meta_data
        const hasMetaData =
            metaRaw !== undefined && metaRaw !== null &&
            String(metaRaw).trim() !== '' && String(metaRaw).trim() !== '{}'
        const routeLineItem = salesorder.line_items.find((li) => isRouteLineItem(li))

        if (!routeLineItem  || hasMetaData) {
            return this.res.status(200).send(utils.responseSuccess({ skipped: true, reason: 'not a manual route order' }))
        }

        try {
            const result = await this.handleManualRouteOrder(salesorder)
            this.log.response = JSON.stringify(result)
            await this.log.save()
            console.log(utils.responseSuccess(result))
            return this.res.status(201).send(utils.responseSuccess(result))
        } catch (error) {
            console.error('[zohoSalesOrder] failed:', error?.response?.data || error.message)
            try {
                await db.webhook_logs.create({
                    event_type: 'manual_route_order_failed',
                    order_id: salesorder.salesorder_id,
                    payload: JSON.stringify({ error: error?.response?.data || error.message, order_ref: salesorder.salesorder_number }),
                    processed: false,
                    error_message: error.message,
                    source: 'zoho_webhook'
                })
            } catch (_) {}
            // 200 so Zoho does not enter a retry storm on a business-logic failure.
            return this.res.status(200).send(utils.responseError(error.message))
        }
    }

    handleManualRouteOrder = async (salesorder) => {
        const salesOrderId = salesorder.salesorder_id
        const orderRef = salesorder.salesorder_number

        // Idempotency (order_reference == salesorder number).
        const existing = await db.shippings.findOne({ where: { order_reference: orderRef } })
        if (existing) {
            console.log(`[manualRoute] shipping already exists for ${orderRef} — checking for status updates`)
            const statusValue = normalizeZohoStatusValue(
                salesorder.status || salesorder.shipment_status || salesorder.delivery_status ||
                findZohoPayloadValue(salesorder, ['status', 'shipment_status', 'delivery_status'])
            )
            let targetStatus = null
            if (statusValue === 'shipped') {
                targetStatus = 'in_transit'
            } else if (['delivered', 'fulfilled', 'complete', 'completed', 'fulfilled_completed'].includes(statusValue)) {
                targetStatus = 'delivered'
            }

            if (targetStatus) {
                // Loop prevention & downgrade guards
                if (existing.status === targetStatus) {
                    console.log(`[manualRoute] status already matched (${existing.status}) for ${orderRef} — skipping update`)
                    return { shipment_reference: existing.shipment_reference, skipped: true, reason: 'status already matched' }
                }
                if (existing.status === 'delivered') {
                    console.log(`[manualRoute] shipment already delivered for ${orderRef} — skipping update`)
                    return { shipment_reference: existing.shipment_reference, skipped: true, reason: 'shipment is already delivered' }
                }
                if (['cancelled', 'failed', 'returned'].includes(existing.status)) {
                    console.log(`[manualRoute] shipment is in terminal state (${existing.status}) for ${orderRef} — skipping update`)
                    return { shipment_reference: existing.shipment_reference, skipped: true, reason: `shipment is in terminal state: ${existing.status}` }
                }

                const updateData = { status: targetStatus }
                if (targetStatus === 'delivered') {
                    updateData.actual_delivery_at = new Date()
                }
                await existing.update(updateData)

                await db.shipment_tracking.create({
                    shipment_id: existing.id,
                    status: targetStatus,
                    location: findZohoPayloadValue(salesorder, ['location', 'city']) || '',
                    description: `Zoho Inventory reported salesorder status is ${statusValue}`,
                    notes: 'Updated from Zoho salesorder webhook',
                    source: 'carrier_api',
                    performed_by: 'zoho_inventory',
                    metadata: { webhook_data: salesorder, source_status: statusValue }
                })

                console.log(`[manualRoute] shipment status updated to ${targetStatus} for order ${orderRef}`)
                return { shipment_reference: existing.shipment_reference, updated: true, status: targetStatus }
            }

            console.log(`[manualRoute] shipping already exists for ${orderRef} — skipping`)
            return { shipment_reference: existing.shipment_reference, skipped: true }
        }

        const routeLineItem = salesorder.line_items.find((li) => isRouteLineItem(li))

        // Salesorder line items DO NOT carry the route custom fields or product weights — those live
        // on the ITEM records. Fetch the full items from Zoho Inventory (itemdetails) and read there.
        const token = await require('../utility/utils.js').getZohoInventoryToken()
        const allItemIds = salesorder.line_items.map((li) => li.item_id || li.variant_id).filter(Boolean)
        const itemsMap = await this.fetchZohoItems(token, allItemIds)
        const routeItem = itemsMap[routeLineItem.item_id] || itemsMap[routeLineItem.variant_id] || routeLineItem

        // --- Route details from the route ITEM (custom fields read by label) ---
        const originStr = getRouteItemCf(routeItem, 'origin', 'cf_origin_city')
        const destinationStr = getRouteItemCf(routeItem, 'destination', 'cf_destination_city')
        let transportMode = String(getRouteItemCf(routeItem, 'Shipping Mode', 'cf_transport_mode') || 'road').toLowerCase()
        if (!['road', 'air', 'sea'].includes(transportMode)) transportMode = 'road'
        let serviceLevel = getRouteItemCf(routeItem, 'service_level', 'cf_service_level') || 'Standard'
        if (!['Express', 'Standard', 'Economy'].includes(serviceLevel)) serviceLevel = 'Standard'
        const driverEmail = getRouteItemCf(routeItem, 'Preferred Driver', 'cf_origin_state')

        let weightBrackets = []
        const rawBrackets = getRouteItemCf(routeItem, 'weight_brackets', 'cf_weight_brackets')
        if (rawBrackets) {
            try { weightBrackets = typeof rawBrackets === 'string' ? JSON.parse(rawBrackets) : rawBrackets }
            catch (e) { console.warn('[manualRoute] weight_brackets parse failed:', e.message) }
        }
        console.log(`[manualRoute] origin="${originStr}" destination="${destinationStr}" mode=${transportMode} level=${serviceLevel} brackets=${JSON.stringify(weightBrackets)}`)

        // Pickup = route origin; delivery = route destination (contact from salesorder shipping address).
        const pickupAddress = buildRouteAddress(originStr)
        const deliveryFallback = buildRouteAddress(destinationStr)
        const shipTo = salesorder.shipping_address || {}
        const custName = String(salesorder.customer_name || '').trim().split(' ')
        const deliveryAddress = {
            first_name: shipTo.first_name || custName[0] || 'Obana',
            last_name: shipTo.last_name || (custName.length > 1 ? custName.slice(1).join(' ') : 'Africa'),
            email: salesorder.contact_persons_associated?.[0]?.contact_person_email || deliveryFallback.email,
            phone: salesorder.contact_person_details?.[0]?.phone || deliveryFallback.phone,
            line1: shipTo.address || deliveryFallback.line1,
            line2: shipTo.street2 || '',
            city: deliveryFallback.city,
            state: deliveryFallback.state,
            country: deliveryFallback.country,
            zip: shipTo.zip || deliveryFallback.zip_code
        }

        // --- Route item quantity is used to scale the actual total weight for this shipment.
        const routeQuantity = parseInt(routeLineItem.quantity) || 1

        // --- Product items (exclude route item). Weight from package_details.weight; qty scales total.
        const productLineItems = salesorder.line_items.filter((li) => !isRouteLineItem(li))
        const items = []
        let totalWeight = 0
        for (const li of productLineItems) {
            const quantity = parseInt(li.quantity) || 1
            const prodItem = itemsMap[li.item_id] || itemsMap[li.variant_id]
            let unitWeight = parseFloat(li.package_details?.weight) || parseFloat(prodItem?.package_details?.weight) || 0
            if (!unitWeight) unitWeight = 0.5 // last-resort default so pricing isn't zeroed out
            const rateUsd = parseFloat(li.rate) || 0
            const totalPriceUsd = parseFloat(li.item_total) || rateUsd * quantity
            const exchangeRate = parseFloat(
                salesorder.custom_field_hash?.cf_exchange_rate_unformatted ||
                salesorder.custom_field_hash?.cf_exchange_rate ||
                salesorder.custom_fields?.find((f) => f.label === 'Exchange Rate' || f.api_name === 'cf_exchange_rate')?.value ||
                1460
            ) || 1460
            const rateNgn = rateUsd * exchangeRate
            const totalPriceNgn = totalPriceUsd * exchangeRate
            totalWeight += unitWeight * quantity
            items.push({
                name: li.name || 'Product',
                description: li.description || li.name || 'Product',
                currency: 'NGN',
                value: totalPriceNgn,
                weight: unitWeight,
                quantity,
                item_id: li.item_id || li.variant_id || li.line_item_id,
                price: rateNgn
            })
        }
        if (items.length === 0) throw new Error('Route item present but no product line items to ship')

        // --- Total current product weight is scaled by route quantity. ---
        totalWeight = totalWeight * routeQuantity

        // --- Pricing from the route item's Zoho-computed line amount (USD) converted to NGN locally. ---
        const routeAmountUsd = parseFloat(routeLineItem.item_total) || (parseFloat(routeLineItem.rate) || 0) * routeQuantity
        const exchangeRate = parseFloat(
            salesorder.custom_field_hash?.cf_exchange_rate_unformatted ||
            salesorder.custom_field_hash?.cf_exchange_rate ||
            salesorder.custom_fields?.find((f) => f.label === 'Exchange Rate' || f.api_name === 'cf_exchange_rate')?.value ||
            1460
        ) || 1460
        const shippingPrice = routeAmountUsd * exchangeRate
        const eta = selectRouteBracket(weightBrackets, totalWeight)?.eta || 'To be determined'

        // Logistics stores NGN; Zoho stores $ (USD). Convert NGN -> USD via the SO exchange rate
        // for anything written back to Zoho (shipment order shipping_charge + salesorder).
        const zohoShippingCharge = exchangeRate > 0 ? shippingPrice / exchangeRate : shippingPrice

        // --- Owner + preferred driver ---
        const systemUserId = await this.resolveSystemUserId()
        if (!systemUserId) throw new Error('System shipment user (shipment@obana.africa) not found in logistics DB')
        const preferredDriverId = driverEmail ? await this.resolveDriverIdByEmail(driverEmail) : null

        // 1) Native logistics shipment (reuse createShipment in-process)
        const shipmentPayload = {
            delivery_address: deliveryAddress,
            pickup_address: pickupAddress,
            items,
            transport_mode: transportMode,
            service_level: serviceLevel,
            currency: { symbol: 'NGN' },
            shipping_fee: shippingPrice,
            carrier_slug: 'obana',
            order_id: orderRef,
            vendor_name: `${pickupAddress.city} Vendor`,
            preferred_driver_id: preferredDriverId,
            notes: `Manual Zoho order ${orderRef}${driverEmail ? ` | preferred driver: ${driverEmail}` : ''}`,
            dispatcher: { carrier_name: 'Obana Logistics', carrier_slug: 'obana', delivery_time: eta }
        }
        const created = await this.createShipmentInProcess(shipmentPayload, systemUserId)
        const shipmentRef = created?.shipment_reference
        if (!shipmentRef) throw new Error(`Shipment creation failed: ${created?.message || 'unknown'}`)
        const trackingUrl = created?.tracking_url || null

        // 2) Zoho package + shipment order (direct Zoho Inventory API). Isolated in its own try so a
        //    failure here (e.g. Zoho blocks package creation on a draft SO) does NOT skip the
        //    salesorder update below. Amounts written to Zoho are converted to USD.
        let zohoShipmentId = null
        try {
            const pkg = await this.createZohoPackage(token, salesorder, productLineItems)
            const packageId = pkg?.package?.package_id
            if (packageId) {
                const zshp = await this.createZohoShipment(token, salesOrderId, packageId, shipmentRef, zohoShippingCharge)
                zohoShipmentId = zshp?.shipmentorder?.shipment_id || null
                if (zohoShipmentId) {
                    await db.shippings.update(
                        { external_shipment_id: zohoShipmentId },
                        { where: { shipment_reference: shipmentRef } }
                    )
                }
            }
        } catch (zErr) {
            console.error('[manualRoute] Zoho package/shipment failed (non-fatal):', zErr?.response?.data || zErr.message)
        }

        // 3) Always reflect status + computed shipping price (USD) onto the salesorder, independent
        //    of whether the package/shipment step above succeeded.
        try {
            await this.updateZohoSalesOrderFields(token, salesOrderId, {
                'Shipment Status': 'shipments_created',
                'Shipment Id': shipmentRef,
                'Tracking URL': trackingUrl || '',
                'Carrier Name': 'Obana Logistics'
            }, zohoShippingCharge)
        } catch (uErr) {
            console.error('[manualRoute] Zoho salesorder update failed (non-fatal):', uErr?.response?.data || uErr.message)
        }

        console.log(`[manualRoute] Shipment ${shipmentRef} (Zoho shipment ${zohoShipmentId}) created for order ${orderRef}`)
        return { shipment_reference: shipmentRef, zoho_shipment_id: zohoShipmentId, price: shippingPrice, total_weight: totalWeight }
    }

    handleZohoShipmentEvent = async () => {
        const payload = this.req?.body || {}
        const statusValue = normalizeZohoStatusValue(
            findZohoPayloadValue(payload, ['status', 'event', 'event_type', 'shipment_status', 'shipment_event'])
        )

        let targetStatus = null
        if (statusValue === 'shipped') {
            targetStatus = 'in_transit'
        } else if (['delivered', 'fulfilled', 'complete', 'completed', 'fulfilled_completed'].includes(statusValue)) {
            targetStatus = 'delivered'
        }

        if (!targetStatus) {
            return this.res.status(200).send(utils.responseSuccess({ skipped: true, reason: `status ${statusValue} not mapped` }))
        }

        const shipmentId = findZohoPayloadValue(payload, ['shipment_id', 'shipmentorder_id', 'shipment_order_id'])
        const orderRef = findZohoPayloadValue(payload, ['salesorder_number', 'sales_order_number', 'order_number', 'order_ref'])

        if (!shipmentId && !orderRef) {
            return this.res.status(200).send(utils.responseSuccess({ skipped: true, reason: 'missing shipment identifier' }))
        }

        let shipment = null
        if (shipmentId) {
            shipment = await db.shippings.findOne({ where: { external_shipment_id: String(shipmentId) } })
        }
        if (!shipment && orderRef) {
            shipment = await db.shippings.findOne({ where: { order_reference: String(orderRef) } })
        }

        if (!shipment) {
            return this.res.status(200).send(utils.responseSuccess({ skipped: true, reason: 'shipment not found' }))
        }

        // Loop prevention & downgrade guards
        if (shipment.status === targetStatus) {
            return this.res.status(200).send(utils.responseSuccess({ updated: false, shipment_reference: shipment.shipment_reference, status: shipment.status, reason: 'status already matched' }))
        }
        if (shipment.status === 'delivered') {
            return this.res.status(200).send(utils.responseSuccess({ updated: false, shipment_reference: shipment.shipment_reference, status: shipment.status, reason: 'shipment is already delivered' }))
        }
        if (['cancelled', 'failed', 'returned'].includes(shipment.status)) {
            return this.res.status(200).send(utils.responseSuccess({ updated: false, shipment_reference: shipment.shipment_reference, status: shipment.status, reason: `shipment is in terminal state: ${shipment.status}` }))
        }

        const updateData = { status: targetStatus }
        if (targetStatus === 'delivered') {
            updateData.actual_delivery_at = new Date()
        }

        await shipment.update(updateData)

        await db.shipment_tracking.create({
            shipment_id: shipment.id,
            status: targetStatus,
            location: findZohoPayloadValue(payload, ['location', 'city']) || '',
            description: `Zoho Inventory reported shipment status is ${statusValue}`,
            notes: 'Updated from Zoho shipment webhook',
            source: 'carrier_api',
            performed_by: 'zoho_inventory',
            metadata: { webhook_data: payload, source_status: statusValue }
        })

        return this.res.status(200).send(utils.responseSuccess({ updated: true, shipment_reference: shipment.shipment_reference, status: targetStatus }))
    }

    zohoShipmentStatus = async () => this.handleZohoShipmentEvent()
    zohoShipmentFulfillment = async () => this.handleZohoShipmentEvent()
    zohoInventoryShipment = async () => this.handleZohoShipmentEvent()
    zohoInventoryFulfillment = async () => this.handleZohoShipmentEvent()
    zohoFulfillment = async () => this.handleZohoShipmentEvent()

    // Resolve the single owning user for ecosystem shipments (shipment@obana.africa).
    resolveSystemUserId = async () => {
        try {
            const email = process.env.LOGISTICS_SYSTEM_EMAIL || 'shipment@obana.africa'
            const user = await db.users.findOne({ where: { email } })
            return user?.id || null
        } catch (e) {
            console.warn('[manualRoute] system user resolve failed:', e.message)
            return null
        }
    }

    resolveDriverIdByEmail = async (email) => {
        try {
            const driver = await db.drivers.findOne({
                include: [{ model: db.users, as: 'user', where: { email }, attributes: ['id', 'email'] }]
            })
            return driver?.id || null
        } catch (e) {
            console.warn('[manualRoute] driver resolve failed:', e.message)
            return null
        }
    }

    // Reuse the full createShipment controller in-process (addresses, items, tracking, emails, driver).
    createShipmentInProcess = async (payload, ownerUserId) => {
        const shipmentController = require('../controllers/shipmentsController')
        const captured = {}
        const fakeReq = { body: payload, user: ownerUserId ? { id: ownerUserId } : null, tenant: null, params: {}, query: {} }
        const fakeRes = {
            status(code) { captured.code = code; return this },
            json(body) { captured.body = body; return this },
            send(body) { captured.body = body; return this }
        }
        await shipmentController.createShipment(fakeReq, fakeRes)
        if (captured.code !== 201) {
            const msg = captured.body?.message || JSON.stringify(captured.body || {})
            throw new Error(`createShipment returned ${captured.code}: ${msg}`)
        }
        return captured.body?.data || {}
    }

    // Direct Zoho Inventory API: create a package for the salesorder's product line items.
    createZohoPackage = async (token, salesorder, productLineItems) => {
        const axios = require('axios')
        const url = `${process.env.ZOHO_BASE_URL}packages?salesorder_id=${salesorder.salesorder_id}&organization_id=${process.env.ZOHO_ORG_ID}`
        const body = {
            package_number: `OBN-PA-${crypto.randomBytes(4).toString('hex')}`,
            date: new Date().toISOString().split('T')[0],
            line_items: (productLineItems || []).map((li) => ({ so_line_item_id: li.line_item_id, quantity: li.quantity })),
            notes: 'obana package for order ' + salesorder.salesorder_number
        }
        const resp = await axios.post(url, body, { headers: { Authorization: token, 'Content-Type': 'application/json' } })
        if (resp.data?.code !== 0) throw new Error(`Zoho package failed: ${resp.data?.message}`)
        return resp.data
    }

    // Direct Zoho Inventory API: create a shipment order for the package.
    createZohoShipment = async (token, salesOrderId, packageId, trackingNumber, shippingCharge) => {
        const axios = require('axios')
        const url = `${process.env.ZOHO_BASE_URL}shipmentorders?salesorder_id=${salesOrderId}&package_ids=${packageId}&organization_id=${process.env.ZOHO_ORG_ID}`
        const body = {
            shipment_number: `OBN-SHIP-${crypto.randomBytes(4).toString('hex')}`,
            date: new Date().toISOString().split('T')[0],
            delivery_method: 'Obana Logistics',
            tracking_number: trackingNumber,
            shipping_charge: shippingCharge,
            notes: 'obana africa shipment for order'
        }
        const resp = await axios.post(url, body, { headers: { Authorization: token, 'Content-Type': 'application/json' } })
        if (resp.data?.code !== 0) throw new Error(`Zoho shipment failed: ${resp.data?.message}`)
        return resp.data
    }

    // Direct Zoho Inventory API: fetch full item records (custom fields + package_details) by ids.
    // The salesorder line items don't carry route custom fields or product weights; the items do.
    fetchZohoItems = async (token, itemIds) => {
        const axios = require('axios')
        try {
            const ids = (itemIds || []).filter(Boolean).join(',')
            if (!ids) return {}
            const url = `${process.env.ZOHO_BASE_URL}itemdetails?item_ids=${ids}&organization_id=${process.env.ZOHO_ORG_ID}`
            const resp = await axios.get(url, { headers: { Authorization: token, 'Content-Type': 'application/json' } })
            const map = {}
            for (const it of (resp.data?.items || [])) {
                if (it.item_id) map[it.item_id] = it
                if (it.variant_id) map[it.variant_id] = it
                if (it.group_id) map[it.group_id] = it
            }
            return map
        } catch (e) {
            console.error('[manualRoute] fetchZohoItems failed:', e?.response?.data || e.message)
            return {}
        }
    }

    // Direct Zoho Inventory API: set salesorder custom fields (+ optional shipping charge) after creation.
    // Falls back to a shipping_charge-only PUT if the combined update is rejected (e.g. a custom-field
    // label not defined on this salesorder would otherwise fail the whole request).
    updateZohoSalesOrderFields = async (token, salesOrderId, labelValueMap, shippingCharge) => {
        const axios = require('axios')
        const url = `${process.env.ZOHO_BASE_URL}salesorders/${salesOrderId}?organization_id=${process.env.ZOHO_ORG_ID}`
        const headers = { Authorization: token, 'Content-Type': 'application/json' }
        const custom_fields = Object.entries(labelValueMap).map(([label, value]) => ({ label, value }))
        const body = { custom_fields }
        const hasCharge = shippingCharge !== undefined && shippingCharge !== null
        if (hasCharge) body.shipping_charge = shippingCharge
        try {
            const resp = await axios.put(url, body, { headers })
            return resp.data
        } catch (e) {
            if (hasCharge) {
                console.warn('[manualRoute] SO update with custom_fields failed; retrying shipping_charge only:', e?.response?.data || e.message)
                const resp = await axios.put(url, { shipping_charge: shippingCharge }, { headers })
                return resp.data
            }
            throw e
        }
    }



    updateZohoSalesOrder = async (salesordersId, paymentStatus = '', shipment_status, order_ref) => {
        this.req.params = { 'tenant': 'zoho', 'endpoint': 'update-orders' }
        this.req.query = { 'order_id': salesordersId }
        if (paymentStatus) {
            this.req.body = {
                "return": 1,
                "salesorder_number": order_ref.toString(),
                "custom_fields": [
                    { "label": "Payment Status", "value": paymentStatus },
                ]
            }
        }

        this.req.body = {
            "return": 1,
            "salesorder_number": order_ref.toString(),
            "custom_fields": [
                { "label": "Shipment Status", "value": shipment_status }]
        }
        let response = await this.makeRequest(this.req, this.res)
        return response
    }

    

 
}

module.exports.WeebHooksHelper = WeebHooksHelper
