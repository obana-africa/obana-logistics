import React from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { C, Callout, DefList, H3, P, Section, Steps } from "@/components/docs/primitives";

/**
 * Thaja.
 *
 * The one integration a merchant does not have to write any code for: Thaja
 * calls Obana on their behalf once a key is saved. So this is written for the
 * merchant setting it up, with the developer detail kept to the end for anyone
 * who wants to know what their store is doing on their behalf.
 */

export function Thaja() {
	return (
		<Section
			id="thaja"
			eyebrow="Platforms"
			title="Thaja"
			aside={
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
					<p className="font-semibold text-slate-900">In short</p>
					<p className="mt-3 text-slate-600">
						Paste one key into your Thaja settings. Your customers then see real delivery prices at
						checkout, and the courier is booked when you ship. No code.
					</p>
				</div>
			}
		>
			<P>
				Thaja stores connect to Obana Logistics from the dashboard — there is nothing to build. You paste your
				Obana store key once, and Thaja does the quoting and the booking for you.
			</P>

			<Callout tone="warn" title="Rolling out">
				The dashboard card is shipping ahead of the store-side quoting and booking. If Connect is not in your
				Thaja settings yet, or saving a key does not change what customers see at checkout, it has not reached
				your store — ask support to enable it rather than assuming the key is wrong.
			</Callout>

			<H3 id="thaja-setup">Connect your store</H3>
			<Steps
				steps={[
					{
						title: "Create a key in Obana",
						children: (
							<P>
								Obana dashboard → Stores &amp; API → create a store for this shop → copy the key. One key
								per shop, so each shop&apos;s shipments stay separate and you can revoke one without
								touching the others.
							</P>
						),
					},
					{
						title: "Paste it into Thaja",
						children: (
							<P>
								Thaja dashboard → Settings → Integrations → Obana Logistics → Connect. Paste the key and
								save. Thaja checks it with Obana before saving, so a mistyped key fails there and then
								rather than at a customer&apos;s checkout weeks later.
							</P>
						),
					},
					{
						title: "Turn on prices at checkout",
						children: (
							<P>
								Connecting does not change your checkout on its own — that is deliberate, so nothing
								moves under your customers without you asking. Use <strong>Turn on at checkout</strong>{" "}
								when you are ready.
							</P>
						),
					},
				]}
			/>

			<Callout tone="tip" title="Your key stays on the server">
				Thaja holds the key server-side and shows you only its last four characters. It is never sent to your
				storefront, because a key that can book shipments has no business in a page a customer can open
				developer tools on.
			</Callout>

			<H3 id="thaja-customer">What your customer sees</H3>
			<DefList
				rows={[
					{
						term: "At checkout",
						children: (
							<>
								The delivery options Obana runs on that lane, priced from the parcel&apos;s weight and
								where it is going — not a flat rate that is wrong in both directions.
							</>
						),
					},
					{ term: "After they pay", children: <>A tracking link, and a WhatsApp message when the parcel moves.</> },
					{ term: "While it travels", children: <>Package Created, In Transit, Fulfilled — the same three words you see.</> },
				]}
			/>

			<H3 id="thaja-behind">What Thaja does on your behalf</H3>
			<P>
				Nothing here is yours to build, but it is worth knowing what your store is doing with your key. These
				are the same public endpoints any platform uses.
			</P>

			<CodeBlock
				title="At checkout — price the lane"
				code={`POST /routes/quote
{
  "origin":      { "city": "Ikeja",   "state": "Lagos", "country_code": "NG" },
  "destination": { "city": "Ughelli", "state": "Delta", "country_code": "NG" },
  "weight_kg": 2,
  "declared_value": 50000
}`}
			/>
			<P>
				No key needed for a quote, so a price can be shown before anyone commits to anything. It returns every
				service on the lane, cheapest first.
			</P>

			<CodeBlock
				title="When you ship — book the courier"
				code={`POST /shipments
Authorization: Bearer <your store key>
{
  "order_id": "TJ-1024",
  "transport_mode": "road",
  "service_level": "Standard",
  "pickup_address":   { ... your location ... },
  "delivery_address": { ... your customer ... },
  "items": [{ "name": "Shirt", "quantity": 1, "weight": 0.5, "value": 200000 }]
}`}
			/>

			<Callout tone="info" title="Your books are not touched">
				This is delivery only. It does not create invoices, move stock or change how your store accounts for
				anything — it prices a lane and books a courier.
			</Callout>

			<H3 id="thaja-troubles">If something looks wrong</H3>
			<DefList
				rows={[
					{ term: "No prices at checkout", children: <>Check that <strong>Turn on at checkout</strong> is on. Connecting alone does not change checkout.</> },
					{ term: '"No Obana route for this lane"', children: <>Obana quotes lanes it runs. The message names the lane so it can be priced — send it to support.</> },
					{ term: "A shipment was refused", children: <>Almost always a missing delivery phone number. A courier cannot collect without one.</> },
					{ term: "The key stopped working", children: <>Rotating a key in Obana does not update Thaja. Paste the new one and save again.</> },
				]}
			/>
		</Section>
	);
}
