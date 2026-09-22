import React from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { C, Callout, DefList, H3, P, Params, Section, Steps } from "@/components/docs/primitives";

/**
 * Integrating Zoho with Obana Logistics.
 *
 * Two routes, because Zoho itself draws a line we cannot cross: it will not put
 * a service item in a package, and a shipment order cannot exist without one.
 * A catalogue of goods can therefore use Zoho's own shipment records end to
 * end; a catalogue of services cannot, and has to drive the same lifecycle from
 * custom fields on the sales order.
 *
 * Written for a developer setting this up in their own Zoho organisation, so it
 * names the fields, the rule conditions and the URLs rather than describing
 * them.
 */

export function ZohoOverview() {
	return (
		<Section
			id="zoho-overview"
			eyebrow="Zoho"
			title="Connect Zoho to Obana Logistics"
			aside={
				<div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
					<p className="font-semibold text-slate-900">What you get</p>
					<ul className="mt-3 space-y-2 text-slate-600">
						<li>Flag an order in Zoho, and the shipment is booked.</li>
						<li>The shipping charge is written back onto the order.</li>
						<li>Status moves in either system and the other follows.</li>
						<li>The customer gets a tracking link by WhatsApp.</li>
					</ul>
				</div>
			}
		>
			<P>
				Obana Logistics connects to Zoho Inventory and Zoho Books directly. Someone in ops flags a sales order,
				a shipment is booked, the price comes back onto the order, and the customer is notified — without
				anyone retyping an address.
			</P>
			<P>
				There are two ways to set it up, and which one you use is decided by your catalogue rather than by
				preference.
			</P>

			<DefList
				rows={[
					{
						term: "Your items are goods",
						children: (
							<>
								Use Zoho&apos;s own shipment records. Zoho creates a package and a shipment order, Obana
								carries the parcel, and both systems hold the same documents. See{" "}
								<a href="#zoho-goods" className="font-medium text-[#1b3b5f] underline">
									Goods: the direct route
								</a>
								.
							</>
						),
					},
					{
						term: "Your items are services",
						children: (
							<>
								Zoho will not put a service item in a package, and a shipment order cannot exist without
								one. The lifecycle lives on the sales order instead. See{" "}
								<a href="#zoho-services" className="font-medium text-[#1b3b5f] underline">
									Services: the custom-field route
								</a>
								.
							</>
						),
					},
				]}
			/>

			<Callout tone="tip" title="Not sure which you have?">
				Open any item in Zoho Inventory. If its type is <C>Service</C>, you need the second route — even if the
				sales-order line says goods. Zoho checks the item master, not the line, and returns error{" "}
				<C>36140</C> when you try to package one.
			</Callout>
		</Section>
	);
}

export function ZohoFields() {
	return (
		<Section id="zoho-fields" eyebrow="Zoho" title="Custom fields to create">
			<P>
				Both routes use the same fields on <strong>Sales Orders</strong>. Create them once, in Zoho Inventory
				under Settings → Preferences → Sales Order → Field Customisation. The API names must match exactly —
				Obana reads them by name.
			</P>

			<Params
				title="Sales order fields"
				params={[
					{ name: "cf_shipment_status", type: "Dropdown", level: "required", children: "Package Created, In Transit, Fulfilled, Failed, Cancelled, Returned. This drives the whole flow." },
					{ name: "cf_create_shipment", type: "Dropdown", level: "optional", children: "One option: Via Obana. An explicit way for ops to send an order, when you would rather not use the status field." },
					{ name: "cf_shipment_id", type: "Text", level: "required", children: "Obana writes the shipment reference here." },
					{ name: "cf_tracking_url", type: "URL", level: "required", children: "Obana writes the customer's tracking link here." },
					{ name: "cf_carrier_name", type: "Text", level: "optional", children: "Obana writes the carrier that took it." },
					{ name: "cf_exchange_rate", type: "Number", level: "optional", children: "The rate the order was priced at. Obana converts the shipping charge with this, so the order keeps adding up." },
					{ name: "cf_currency_code", type: "Text", level: "optional", children: "The currency the customer sees, when it differs from the organisation's." },
					{ name: "cf_salesperson_phone", type: "Phone", level: "optional", children: "Who to notify besides the customer." },
				]}
			/>

			<Callout tone="warn" title="cf_shipment_status is the one that matters">
				Obana accepts an order flagged either way — <C>cf_create_shipment = Via Obana</C>, or{" "}
				<C>cf_shipment_status</C> set to a value meaning Package Created. If you only create one field, create
				the status one: it also drives the later stages.
			</Callout>
		</Section>
	);
}

export function ZohoGoods() {
	return (
		<Section id="zoho-goods" eyebrow="Zoho" title="Goods: the direct route">
			<P>
				When your items are goods, Zoho can hold the shipment itself. A package is created against the sales
				order, a shipment order is raised against the package, and Obana carries the parcel. Both systems end up
				holding the same documents, so a reconciliation is a comparison rather than an investigation.
			</P>

			<Steps
				steps={[
					{
						title: "Create the custom fields",
						children: <P>As above. Obana reads and writes them by API name.</P>,
					},
					{
						title: "Add a workflow rule that books the shipment",
						children: (
							<>
								<P>
									Zoho Inventory → Settings → Automation → Workflow Rules → New. Module{" "}
									<C>Sales Orders</C>, executed <strong>when a field is updated</strong>, on{" "}
									<C>cf_shipment_status</C>.
								</P>
								<P>Condition: cf_shipment_status is Package Created. Action: a webhook.</P>
							</>
						),
					},
					{
						title: "Point the webhook at Obana",
						children: (
							<>
								<P>
									Method <C>POST</C>. URL, with your own secret:
								</P>
								<CodeBlock
									title="Webhook URL"
									code={`https://logistics.obana.africa/zoho/shipment-trigger?salesorder_id=\${SALESORDER.SALESORDER_ID}&secret=YOUR_WEBHOOK_SECRET`}
								/>
								<P>
									The <C>salesorder_id</C> parameter is required. Obana fetches the order from Zoho
									with it — the webhook body itself is not relied upon, because Zoho sends XML and its
									placeholders do not always resolve.
								</P>
							</>
						),
					},
					{
						title: "Let Obana write back",
						children: (
							<P>
								Obana books the shipment, creates the package and shipment order in Zoho, and writes{" "}
								<C>cf_shipment_id</C>, <C>cf_tracking_url</C>, <C>cf_carrier_name</C> and the shipping
								charge onto the order. Nothing further to configure.
							</P>
						),
					},
					{
						title: "Add rules for the later stages",
						children: (
							<>
								<P>
									Two more rules on the same field, pointing at the status endpoint, so a status
									changed in Zoho reaches Obana:
								</P>
								<CodeBlock
									title="Webhook URL"
									code={`https://logistics.obana.africa/zoho/shipment-status?salesorder_id=\${SALESORDER.SALESORDER_ID}&status=\${SALESORDER.CF_SHIPMENT_STATUS}&secret=YOUR_WEBHOOK_SECRET`}
								/>
								<P>One rule for In Transit, one for Fulfilled. Both use the same URL.</P>
							</>
						),
					},
				]}
			/>

			<Callout tone="info" title="Where the shipping charge comes from">
				Obana prices the lane from the pickup and delivery addresses on the order and the weight of the items,
				then writes that figure to the order&apos;s shipping charge. It converts with{" "}
				<C>cf_exchange_rate</C> when the order carries one, so the charge is in the same currency as everything
				else on the order rather than in a rate from somewhere else.
			</Callout>
		</Section>
	);
}

export function ZohoServices() {
	return (
		<Section id="zoho-services" eyebrow="Zoho" title="Services: the custom-field route">
			<P>
				Zoho refuses to put a service item in a package — error <C>36140</C> — and a shipment order cannot exist
				without a package. A marketplace whose catalogue is services therefore has no Zoho shipment record to
				move through statuses.
			</P>
			<P>
				The sales order&apos;s own fields become the lifecycle. It is the same flow as above and the same
				endpoints; the difference is that Zoho holds no package, and <C>cf_shipment_status</C> is the only
				record of where the parcel is.
			</P>

			<Steps
				steps={[
					{
						title: "Create the same custom fields",
						children: (
							<P>
								Identical to the goods route. <C>cf_shipment_status</C> is not optional here — it is the
								only place the lifecycle can live.
							</P>
						),
					},
					{
						title: "One rule per stage, all on cf_shipment_status",
						children: (
							<DefList
								rows={[
									{ term: "Package Created", children: <>Books the shipment. Points at <C>/zoho/shipment-trigger</C>.</> },
									{ term: "In Transit", children: <>Moves it. Points at <C>/zoho/shipment-status</C>.</> },
									{ term: "Fulfilled", children: <>Closes it. Points at <C>/zoho/shipment-status</C>.</> },
								]}
							/>
						),
					},
					{
						title: "Set the weight on your items",
						children: (
							<P>
								Obana prices on weight. Put it in the item&apos;s <C>package_details.weight</C> in Zoho.
								Items with no weight ship at a default, which is how a heavy item quietly moves at a
								light item&apos;s price — the shipment records which lines were defaulted so you can
								find them.
							</P>
						),
					},
				]}
			/>

			<Callout tone="warn" title="Do not let a rule fire on every edit">
				A rule set to run whenever the record is updated re-sends the same status each time anyone touches the
				order, and Obana&apos;s own write-back is an edit. Trigger on <strong>field updated</strong>, on{" "}
				<C>cf_shipment_status</C> only. Obana will not move a parcel backwards, but an unconstrained rule still
				spends your Zoho API quota.
			</Callout>
		</Section>
	);
}

export function ZohoTroubleshooting() {
	return (
		<Section id="zoho-troubleshooting" eyebrow="Zoho" title="When nothing happens">
			<P>
				Zoho reports a webhook as delivered as soon as Obana answers, and Obana answers immediately so the rule
				does not time out. A delivered webhook therefore does not mean a shipment was created. These two
				endpoints tell you what actually happened.
			</P>

			<H3 id="zoho-recent">What Zoho actually sent</H3>
			<CodeBlock title="Terminal" code={`curl "https://logistics.obana.africa/zoho/recent?limit=10"`} />
			<P>
				The last few requests Zoho made, with the parameters it sent and the answer it got. This is where an
				unresolved placeholder shows up — a rule that sends the literal text{" "}
				<C>{"${SALESORDER.SALESORDER_ID}"}</C> looks fine in Zoho and does nothing here.
			</P>

			<H3 id="zoho-wait">Run it and see the error</H3>
			<CodeBlock
				title="Terminal"
				code={`curl -X POST "https://logistics.obana.africa/zoho/shipment-trigger?salesorder_id=SALESORDER_ID&wait=1&secret=YOUR_WEBHOOK_SECRET"`}
			/>
			<P>
				<C>wait=1</C> runs the booking inline and returns the reason it failed instead of the usual immediate
				acknowledgement. Use it on an order that did not come through: it names the cause — a missing phone, an
				address with no city, an item Zoho will not package — in one call.
			</P>

			<H3 id="zoho-common">The usual causes</H3>
			<DefList
				rows={[
					{ term: "No phone number", children: <>A courier cannot collect without one. Obana looks at the shipping address, then the order&apos;s contact person, then the customer record.</> },
					{ term: "No address on the order", children: <>Obana falls back to the customer record, so the address may be on the customer rather than missing.</> },
					{ term: "No route for that lane", children: <>Obana quotes lanes it runs. The error names the lane so it can be priced.</> },
					{ term: "Cannot package a service", children: <>Error 36140. Zoho checks the item master, not the sales-order line. Use the services route.</> },
				]}
			/>
		</Section>
	);
}
