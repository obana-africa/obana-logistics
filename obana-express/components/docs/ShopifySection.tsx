import React from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { C, Callout, DefList, H3, P, Section, Steps } from "@/components/docs/primitives";

/**
 * Shopify.
 *
 * There is no Obana app in the Shopify app store, and this says so rather than
 * implying otherwise. What there is works today: Shopify tells your own backend
 * that an order was paid, and your backend books the shipment. The whole guide
 * is that one sentence made concrete.
 */

export function Shopify() {
	return (
		<Section
			id="shopify"
			eyebrow="Platforms"
			title="Shopify"
			aside={
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
					<p className="font-semibold text-slate-900">In short</p>
					<p className="mt-3 text-slate-600">
						Shopify tells your backend an order was paid. Your backend books the shipment with Obana and
						writes the tracking number back to Shopify. Two calls.
					</p>
				</div>
			}
		>
			<P>
				There is no Obana app in the Shopify app store yet. You connect the two with a small piece of your own
				code — a serverless function is enough — and it takes about an hour.
			</P>

			<Callout tone="warn" title="Never put the key in your theme">
				A store API key can book shipments and spend money. Anything in theme code, a script tag or a storefront
				app is readable by every visitor. The key belongs on a server you control, and nowhere else.
			</Callout>

			<H3 id="shopify-flow">The flow</H3>
			<DefList
				rows={[
					{ term: "1. Shopify → you", children: <>An <C>orders/paid</C> webhook fires when a customer pays.</> },
					{ term: "2. You → Obana", children: <>Book the shipment with the order&apos;s address and line items.</> },
					{ term: "3. You → Shopify", children: <>Write the Obana tracking number onto the fulfilment, so the customer sees it in Shopify&apos;s own emails.</> },
					{ term: "4. Obana → you", children: <>Status webhooks as the parcel moves, which you can mirror onto the order.</> },
				]}
			/>

			<Steps
				steps={[
					{
						title: "Create a store key",
						children: (
							<P>
								In your Obana dashboard, Stores &amp; API → create a store for the Shopify shop → copy the
								key. One key per shop, so you can see each shop&apos;s shipments separately and revoke one
								without touching the others.
							</P>
						),
					},
					{
						title: "Subscribe to orders/paid",
						children: (
							<>
								<P>
									In Shopify admin: Settings → Notifications → Webhooks → Create webhook. Event{" "}
									<C>Order payment</C>, format JSON, pointed at your own endpoint.
								</P>
								<P>
									Verify Shopify&apos;s HMAC header before trusting the body — anyone can post to a public
									URL.
								</P>
							</>
						),
					},
					{
						title: "Show the price before checkout (optional)",
						children: (
							<>
								<P>
									Quote the lane from your backend and return it to the cart, so the customer sees the
									real delivery price rather than a flat rate:
								</P>
								<CodeBlock
									title="Quote a lane"
									code={`curl -X POST https://logistics.obana.africa/routes/quote \\
  -H "Content-Type: application/json" \\
  -d '{
    "origin":      { "city": "Ikeja",   "state": "Lagos", "country_code": "NG" },
    "destination": { "city": "Ughelli", "state": "Delta", "country_code": "NG" },
    "weight_kg": 2,
    "declared_value": 50000
  }'`}
								/>
								<P>
									This one needs no key, so it is safe to call from a serverless function without
									secrets. It returns every service on the lane, cheapest first.
								</P>
							</>
						),
					},
					{
						title: "Book the shipment when the order is paid",
						children: (
							<CodeBlock
								title="Your webhook handler"
								code={`// Shopify sends the paid order; you send Obana a shipment.
const order = req.body;

const shipment = await fetch("https://logistics.obana.africa/shipments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.OBANA_STORE_KEY}\`,
  },
  body: JSON.stringify({
    order_id: order.name,                    // "#1024" — your reference in Obana
    transport_mode: "road",
    service_level: "Standard",
    pickup_address:   YOUR_WAREHOUSE,
    delivery_address: {
      first_name: order.shipping_address.first_name,
      last_name:  order.shipping_address.last_name,
      phone:      order.shipping_address.phone,   // required: a courier must be able to call
      email:      order.email,
      line1:      order.shipping_address.address1,
      city:       order.shipping_address.city,
      state:      order.shipping_address.province,
      country:    order.shipping_address.country,
    },
    items: order.line_items.map((li) => ({
      name: li.title,
      quantity: li.quantity,
      weight: (li.grams || 500) / 1000,      // Obana prices in kilograms
      value: Number(li.price),
    })),
  }),
}).then((r) => r.json());`}
							/>
						),
					},
					{
						title: "Write the tracking number back to Shopify",
						children: (
							<CodeBlock
								title="Back to Shopify"
								code={`await shopify.fulfillment.create(order.id, {
  tracking_number:  shipment.data.shipment_reference,
  tracking_url:     shipment.data.tracking_url,
  tracking_company: "Obana Logistics",
  notify_customer:  true,
});`}
							/>
						),
					},
				]}
			/>

			<Callout tone="tip" title="Two details that cost people an afternoon">
				Shopify holds weight in <strong>grams</strong> and Obana prices in kilograms — divide by 1000. And a
				shipment is refused without a delivery phone number: Shopify makes it optional at checkout, so make it
				required, or fall back to the customer&apos;s account phone.
			</Callout>
		</Section>
	);
}
