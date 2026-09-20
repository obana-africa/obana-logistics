# Obana Logistics × Zoho Books / Zoho Inventory — Integration Brief

**Prepared by:** Korede Oluwabusuyi, Senior Product Manager, Obana Africa
**Date:** 14 September 2026
**Purpose:** Background for a technical call with a Zoho specialist on the recommended integration approach.

---

## 1. About Obana Africa

Obana Africa is a B2B marketplace for fashion and beauty businesses in Nigeria and across Africa. We run order, inventory and accounting operations on **Zoho Books** and **Zoho Inventory**, and we operate our own logistics platform, **Obana Logistics**, which is live and manages deliveries.

## 2. What Obana Logistics does today

| Capability | Details |
|---|---|
| Delivery management | Pickup, delivery and driver/agent assignment for our own fleet, plus partner carriers for longer and international routes |
| Pricing | Route-based pricing by weight across Nigeria's 36 states and the FCT, Africa, and imports to Lagos; partner-carrier rates with markup |
| Tracking | Status history per shipment and a public tracking link (e.g. `?track=OBN-…`) |
| API | REST API with per-store API keys, and signed webhooks for shipment events |
| Existing Zoho touchpoints | Route/service items created and updated in **Zoho Inventory**; a webhook endpoint that creates routes from Zoho items; sales order salesperson details used for delivery notifications |

## 3. Workflow we want to achieve

1. **Order created** in Zoho Books / Zoho Inventory (sales order).
2. **Ready for fulfilment** — e.g. sales order confirmed, or package/shipment created in Zoho Inventory — triggers a call to Obana Logistics with the order details.
3. **Obana Logistics** prices the delivery, books it (own fleet or partner) and tracks it through to delivery.
4. **Sync back to Zoho:** delivery status, tracking number/link, carrier, and the logistics cost.

## 4. Data we expect to exchange

**Zoho → Obana Logistics (on fulfilment)**
- Sales order ID and number, customer name, email, phone
- Shipping address (street, city, state, country)
- Line items: name, SKU, quantity, weight, value
- Pickup/warehouse location

**Obana Logistics → Zoho (during and after delivery)**
- Shipment reference and tracking URL
- Carrier name and delivery status (e.g. picked up, in transit, delivered, failed)
- Delivery date/time
- Logistics cost (to record as a shipping charge, expense or bill)

## 5. Questions for Zoho

1. Which approach do you recommend: a direct integration listed by Zoho, a custom integration using the **Zoho Books / Inventory APIs**, **webhooks/workflow rules**, or **Deluge custom functions**?
2. Which event is best for triggering fulfilment (sales order confirmed, package created, or shipment created), and can it send a webhook to an external URL?
3. What is the right way to write tracking and delivery status back: the shipment/package records in Zoho Inventory, or custom fields on the sales order?
4. How should logistics costs be recorded: a shipping charge on the invoice, an expense, or a vendor bill?
5. Can a third-party carrier be registered in Zoho Inventory so our tracking shows natively (similar to built-in carrier integrations)?
6. Are there API rate limits, plan/subscription requirements or add-ons we need, and is a sandbox available for testing?
7. Is there a partner or marketplace listing route (e.g. Zoho Marketplace / Zoho Developer) if we later offer this integration to other businesses?

## 6. Contact

**Korede Oluwabusuyi** — Senior Product Manager, Obana Africa, Nigeria
