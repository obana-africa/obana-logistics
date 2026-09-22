import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, MapPin, Package, Radio } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/site";
import { CodeBlock, CodeTabs } from "@/components/docs/CodeBlock";
import { C, Callout, DefList, Endpoint, H3, P, Params, Section, Steps } from "@/components/docs/primitives";
import * as S from "@/components/docs/samples";
import { ZohoFields, ZohoGoods, ZohoOverview, ZohoServices, ZohoTroubleshooting } from "@/components/docs/ZohoSections";
import { Shopify } from "@/components/docs/ShopifySection";

// The developer docs: task-first guides with copy-paste examples. Documents only what the API actually does.

const linkClass = "font-medium text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy";

function Hero() {
	const cards = [
		{ href: "#quote", icon: <MapPin className="h-5 w-5" aria-hidden />, title: "Price a delivery", text: "Live prices for any route, no key needed." },
		{ href: "#create-shipment", icon: <Package className="h-5 w-5" aria-hidden />, title: "Book a shipment", text: "One call per order. Safe to retry." },
		{ href: "#webhooks", icon: <Radio className="h-5 w-5" aria-hidden />, title: "Stay in sync", text: "Signed webhooks on every status change." },
	];
	return (
		<header className="pb-12 pt-8 sm:pt-12">
			<p className="text-xs font-semibold uppercase tracking-wider text-amber">Developers</p>
			<h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight text-ink sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
				Ship from your store with the Obana API
			</h1>
			<p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
				Connect your website, Shopify store or custom app in minutes. Show live delivery prices at checkout, book a shipment for every order, and follow each shipment and customer — your system hears about every status change as it happens.
			</p>
			<div className="mt-7 flex flex-col gap-3 sm:flex-row">
				<Link href="/onboarding/business" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700">
					Create your store key
					<ArrowRight className="h-4 w-4" aria-hidden />
				</Link>
				<a href="#quickstart" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-slate-50">
					Read the quickstart
				</a>
			</div>

			<div className="mt-10 max-w-2xl">
				<CodeBlock title="Base URL" code={S.BASE_URL} />
				<p className="mt-2 text-sm text-muted">Every path on this page is relative to this address. All requests and responses are JSON over HTTPS.</p>
			</div>

			<div className="mt-10 grid gap-4 sm:grid-cols-3">
				{cards.map((card) => (
					<a key={card.href} href={card.href} className="group rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift">
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-navy">{card.icon}</span>
						<p className="mt-4 font-semibold text-ink">{card.title}</p>
						<p className="mt-1 text-sm leading-6 text-slate-600">{card.text}</p>
					</a>
				))}
			</div>
		</header>
	);
}

function Quickstart() {
	return (
		<Section
			id="quickstart"
			eyebrow="Get started"
			title="Quickstart"
			aside={
				<>
					<CodeTabs title="GET /stores/me" samples={S.testKey} />
					<CodeBlock title="Response · 200" code={S.storesMeResponse} />
				</>
			}
		>
			<P>Five steps from zero to a working key. Each store you run (website, Shopify shop, mobile app) gets its own key, so you can see and control their shipments separately.</P>
			<Steps
				steps={[
					{
						title: "Sign in to Obana",
						children: (
							<>
								<Link href="/auth/login" className={linkClass}>
									Sign in
								</Link>{" "}
								or{" "}
								<Link href="/auth/signup" className={linkClass}>
									create a free account
								</Link>
								.
							</>
						),
					},
					{
						title: "Open Stores & API",
						children: (
							<>
								In your dashboard, go to <strong className="text-ink">Stores & API</strong>.
							</>
						),
					},
					{
						title: "Add a store and copy its key",
						children: (
							<>
								Click <strong className="text-ink">Add store</strong>. Your key (<C>obk_live_…</C>) is shown <strong className="text-ink">once</strong> — we only keep a hashed copy. Lost it? Rotate the key to get a new one; the old key stops working straight away.
							</>
						),
					},
					{
						title: "Add a webhook URL (optional)",
						children: (
							<>
								Give the store a public <C>https://</C> address and press <strong className="text-ink">Send test event</strong> to check it arrives. See <a href="#webhooks" className={linkClass}>Webhooks</a>.
							</>
						),
					},
					{
						title: "Test your key",
						children: (
							<>
								Call <C>GET /stores/me</C>. A <C>200</C> with your store’s name means you’re connected.
							</>
						),
					},
				]}
			/>
			<div className="mt-7">
				<Link href="/onboarding/business" className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700">
					Create your store key
					<ArrowRight className="h-4 w-4" aria-hidden />
				</Link>
			</div>
			<Callout tone="tip" title="On Shopify or another hosted platform?">
				Make the calls from code you control — your own backend or a serverless function — for example when your platform tells you a new order was paid. The key must never go into theme, storefront or app code.
			</Callout>
		</Section>
	);
}

function Authentication() {
	return (
		<Section
			id="authentication"
			eyebrow="Get started"
			title="Authentication"
			aside={
				<>
					<CodeBlock title="Request header" code={S.authHeader} />
					<CodeBlock title="Response · 403" code={S.forbiddenResponse} />
				</>
			}
		>
			<P>
				Send your store key as a bearer token in the <C>Authorization</C> header of every call that needs one.
			</P>
			<H3>What a store key can do</H3>
			<P>Store keys are made for integrations and only open these calls:</P>
			<ul className="mt-3 space-y-2 text-[15px] leading-7 text-slate-700">
				{[
					<>
						Get quotes — <C>POST /routes/quote</C>
					</>,
					<>
						Create shipments — <C>POST /shipments</C>
					</>,
					<>
						List your store’s shipments — <C>GET /stores/me/shipments</C>
					</>,
					<>
						Track and cancel your store’s shipments — <C>/shipments/track/…</C>, <C>/shipments/cancel/…</C>
					</>,
					<>
						Check the key — <C>GET /stores/me</C>
					</>,
				].map((item, i) => (
					<li key={i} className="flex gap-2.5">
						<CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
						<span className="min-w-0">{item}</span>
					</li>
				))}
			</ul>
			<P>
				Any other route answers <C>403</C>. So does a key whose store is <strong className="text-ink">paused</strong> — un-pause the store in your dashboard to switch it back on. A missing key gets <C>401</C>.
			</P>
			<Callout tone="warn" title="Keep keys on your server">
				Anyone with your key can create shipments billed to your store. Store it in a server environment variable, never in browser JavaScript, mobile app code or a git repository. If a key leaks, rotate it in <strong>Stores & API</strong> — the old one stops working immediately.
			</Callout>
			<Callout tone="info" title="Older OBN- account keys">
				Account keys starting with <C>OBN-</C> still work, but they aren’t tied to a store. New integrations should use store keys (<C>obk_live_…</C>).
			</Callout>
		</Section>
	);
}

function Responses() {
	return (
		<Section
			id="responses"
			eyebrow="Get started"
			title="Responses & errors"
			aside={
				<>
					<CodeBlock title="Success" code={S.successEnvelope} />
					<CodeBlock title="Error" code={S.errorEnvelope} />
					<CodeBlock title="Shipment validation error · 400" code={S.validationError} />
				</>
			}
		>
			<P>
				Successful calls answer <C>{`{ "status": "success", "data": … }`}</C>. Failed calls answer <C>{`{ "status": "error", "message": "…" }`}</C> with a plain-English message you can show your team. Shipment calls (<C>/shipments…</C>) use <C>{`"success": true`}</C> or <C>{`false`}</C> instead of <C>status</C>, so check the HTTP status code first.
			</P>
			<DefList
				rows={[
					{ term: <C>200 / 201</C>, children: "It worked. 201 means a shipment was created." },
					{
						term: <C>400</C>,
						children: (
							<>
								Something in the request is missing or wrong. Read <C>message</C>, and <C>errors</C> when present — it lists every field to fix.
							</>
						),
					},
					{ term: <C>401</C>, children: "No key was sent." },
					{ term: <C>403</C>, children: "The key is invalid, its store is paused, or store keys can’t use this route." },
					{ term: <C>404</C>, children: "Not found — or it belongs to another store." },
					{
						term: <C>429</C>,
						children: (
							<>
								Too many requests. Wait for the number of seconds in the <C>Retry-After</C> header, then try again.
							</>
						),
					},
					{ term: <C>5xx</C>, children: "Something went wrong on our side. Retry with backoff (for example after 1 s, 2 s, 4 s)." },
				]}
			/>
			<P>
				There are no <C>409</C> conflicts: sending an <C>order_id</C> you’ve already used returns the existing shipment instead (see <a href="#create-shipment" className={linkClass}>Create a shipment</a>).
			</P>
		</Section>
	);
}

function Quote() {
	return (
		<Section
			id="quote"
			eyebrow="Shipments"
			title="Get a quote"
			aside={
				<>
					<CodeTabs title="POST /routes/quote" samples={S.quote} />
					<CodeBlock title="Response · 200" code={S.quoteResponse} />
				</>
			}
		>
			<P>Show buyers real delivery prices before they pay. Every option on the route comes back, with the cheapest and fastest marked for you.</P>
			<Endpoint method="POST" path="/routes/quote" auth="none" />
			<P>
				No key is needed, so it’s fine to proxy it for your checkout. Limit: <strong className="text-ink">20 quotes per 10 minutes per IP address</strong>. Identical quotes are cached for 30 minutes.
			</P>
			<Params
				title="Body"
				params={[
					{
						name: "origin",
						type: "object",
						level: "required",
						children: "Where the parcel starts.",
						fields: [
							{ name: "country", type: "string", level: "required", children: "Country name, e.g. United Kingdom." },
							{ name: "country_code", type: "string", level: "required", children: "ISO code, e.g. GB." },
							{ name: "state", type: "string", level: "required", children: "State, region or county." },
							{ name: "state_code", type: "string", level: "optional", children: "State code when you have it, e.g. LA for Lagos." },
							{ name: "city", type: "string", level: "required" },
						],
					},
					{ name: "destination", type: "object", level: "required", children: "Where it’s going. Same fields as origin." },
					{ name: "weight_kg", type: "number", level: "required", children: "Total weight in kg, from 0.1 to 1000." },
					{ name: "declared_value", type: "number", level: "optional", children: "Value of the goods in NGN." },
					{
						name: "display_currency",
						type: "string",
						level: "optional",
						children: (
							<>
								ISO currency to show prices in as well, e.g. <C>GBP</C>.
							</>
						),
					},
				]}
			/>
			<Params
				title="Response data"
				params={[
					{
						name: "options[]",
						type: "array",
						children: "One entry per way to ship.",
						fields: [
							{
								name: "id",
								type: "string",
								children: (
									<>
										Pass it as <C>quote_option_id</C> when you create the shipment.
									</>
								),
							},
							{
								name: "provider",
								type: "string",
								children: (
									<>
										<C>obana</C> (our own network) or <C>partner</C> (a carrier we book for you).
									</>
								),
							},
							{ name: "carrier_name, logo_url", type: "string", children: "Who carries it. logo_url can be null." },
							{ name: "transport_mode, service_level", type: "string", children: "e.g. road + Standard. Can be null for partner options." },
							{ name: "eta", type: "string", children: "Estimated delivery time, e.g. 3-5 days." },
							{ name: "price", type: "number", children: "What you pay, in NGN." },
							{ name: "display_price", type: "number | null", children: "price converted to display_currency." },
						],
					},
					{ name: "cheapest_id, fastest_id", type: "string", children: "Ids of the cheapest and fastest options. fastest_id is null if no option has an ETA." },
					{ name: "currency, display_currency", type: "string", children: "Always NGN, and the currency display_price is in." },
					{ name: "fx", type: "object | null", children: "The rate used: rate, as_of and source. null when no conversion was needed or available." },
					{ name: "expires_at", type: "string", children: "When this price stops being guaranteed. Quote again after it." },
				]}
			/>
			<Callout tone="info" title="Prices are charged in naira">
				<C>price</C> is what you’re charged, in NGN. <C>display_price</C> is only a conversion at today’s rate to help your buyers — the amount charged stays in NGN.
			</Callout>
			<P>
				A route we don’t cover yet answers <C>404</C> with <C>No routes available for this shipment</C>.
			</P>
		</Section>
	);
}

function CreateShipment() {
	return (
		<Section
			id="create-shipment"
			eyebrow="Shipments"
			title="Create a shipment"
			aside={
				<>
					<CodeTabs title="POST /shipments" samples={S.createShipment} />
					<CodeBlock title="Response · 201" code={S.createResponse} />
					<CodeBlock title="Same order_id again · 200" code={S.duplicateResponse} />
				</>
			}
		>
			<P>Book a delivery for an order. Call it when the order is paid; we price it, assign the carrier and start tracking.</P>
			<Endpoint method="POST" path="/shipments" auth="store" />
			<Params
				title="Recommended"
				params={[
					{
						name: "order_id",
						type: "string",
						level: "recommended",
						children: (
							<>
								Your order number. Sending the same <C>order_id</C> again returns the existing shipment with <C>{`"duplicate": true`}</C> instead of creating another — so retries after a timeout are safe.
							</>
						),
					},
					{
						name: "customer",
						type: "object",
						level: "recommended",
						children: "Your customer, so you can list every shipment for them later.",
						fields: [
							{ name: "id", type: "string", children: "Your own customer ID." },
							{ name: "name, email, phone", type: "string" },
						],
					},
					{
						name: "quote_option_id",
						type: "string",
						level: "recommended",
						children: (
							<>
								An <C>id</C> from <a href="#quote" className={linkClass}>Get a quote</a> — the option your buyer chose. If you leave it out, the cheapest option is used.
							</>
						),
					},
				]}
			/>
			<Params
				title="Required"
				params={[
					{
						name: "pickup_address",
						type: "object",
						level: "required",
						children: "Where we collect the parcel.",
						fields: [
							{ name: "line1, city, state, country, phone", type: "string", level: "required" },
							{ name: "contact_name, email, line2, zip_code", type: "string", level: "optional" },
						],
					},
					{
						name: "delivery_address",
						type: "object",
						level: "required",
						children: "Your customer’s address.",
						fields: [
							{ name: "first_name, last_name, line1, city, state, country, phone", type: "string", level: "required" },
							{ name: "email, line2, zip", type: "string", level: "optional" },
						],
					},
					{
						name: "items[]",
						type: "array",
						level: "required",
						children: "What’s in the parcel.",
						fields: [
							{ name: "name", type: "string", level: "required" },
							{ name: "quantity", type: "integer", level: "required" },
							{ name: "weight", type: "number", level: "required", children: "Weight of one item, in kg." },
							{ name: "price", type: "number", level: "required", children: "Value of one item, in NGN." },
							{ name: "description", type: "string", level: "optional" },
						],
					},
					{
						name: "transport_mode",
						type: "string",
						level: "required",
						children: (
							<>
								<C>road</C>, <C>air</C> or <C>sea</C>.
							</>
						),
					},
					{
						name: "service_level",
						type: "string",
						level: "required",
						children: (
							<>
								<C>Express</C>, <C>Standard</C> or <C>Economy</C>.
							</>
						),
					},
				]}
			/>
			<Callout tone="info" title="Obana sets the price">
				The fee is always calculated by Obana for the route and weight. Any <C>shipping_fee</C> you send is ignored.
			</Callout>
			<P>
				Save <C>shipment_reference</C> (for tracking) and <C>shipment_id</C> (for cancelling) against your order, and share <C>tracking_url</C> with your customer. The fee charged comes back straight away as <C>shipping_fee</C> (with <C>currency</C>), and also when you <a href="#list-shipments" className={linkClass}>list shipments</a> and in webhook events.
			</P>
			<H3>When it fails</H3>
			<P>
				Missing or invalid fields answer <C>400</C> with <C>{`"message": "Invalid payload"`}</C> and an <C>errors</C> array naming each field. A route we don’t cover answers <C>400</C> with:
			</P>
			<div className="mt-4">
				<CodeBlock title="Response · 400" code={S.routeError} />
			</div>
		</Section>
	);
}

function ListShipments() {
	return (
		<Section
			id="list-shipments"
			eyebrow="Shipments"
			title="List your shipments"
			aside={
				<>
					<CodeTabs title="GET /stores/me/shipments" samples={S.listAll} />
					<CodeBlock title="Response · 200" code={S.listResponse} />
				</>
			}
		>
			<P>Everything your store has shipped, newest first. Filter by customer, order number or status to answer the questions your team gets every day.</P>
			<Endpoint method="GET" path="/stores/me/shipments" auth="store" />
			<Params
				title="Query parameters (all optional)"
				params={[
					{ name: "status", type: "string", children: <>One of the <a href="#statuses" className={linkClass}>statuses</a>, e.g. <C>in_transit</C>.</> },
					{ name: "order_id", type: "string", children: "Your order number." },
					{ name: "customer_id", type: "string", children: "The customer.id you sent when creating shipments." },
					{ name: "q", type: "string", children: "Search by shipment reference or order number (partial match)." },
					{ name: "page", type: "integer", children: "Page number, starting at 1." },
					{ name: "limit", type: "integer", children: "Results per page, up to 100." },
				]}
			/>
			<Params
				title="Each shipment"
				params={[
					{ name: "id, reference", type: "number, string", children: "Our shipment id (for cancelling) and reference (for tracking)." },
					{ name: "order_id, customer", type: "string, object", children: "What you sent when creating it." },
					{ name: "status", type: "string", children: <>See <a href="#statuses" className={linkClass}>statuses</a>.</> },
					{
						name: "carrier",
						type: "object",
						children: (
							<>
								<C>type</C> is <C>obana</C> or <C>partner</C>, plus <C>name</C>. Partner shipments may include the carrier’s <C>tracking_number</C>.
							</>
						),
					},
					{ name: "shipping_fee, currency", type: "number, string", children: "What the shipment costs (NGN)." },
					{ name: "tracking_url", type: "string", children: "Public tracking page to share with your customer." },
					{ name: "destination", type: "object", children: "name, city, state and country of the delivery address." },
					{ name: "created_at, updated_at", type: "string", children: "ISO 8601 timestamps." },
				]}
			/>
			<P>
				<C>pagination</C> gives <C>total</C>, <C>page</C>, <C>pages</C> and <C>limit</C>.
			</P>

			<H3>Recipe: all shipments for one of your customers</H3>
			<div className="mt-4">
				<CodeTabs samples={S.listByCustomer} />
			</div>
			<H3>Recipe: find a shipment by your order number</H3>
			<div className="mt-4">
				<CodeTabs samples={S.listByOrder} />
			</div>
			<H3>Recipe: everything in transit right now</H3>
			<div className="mt-4">
				<CodeTabs samples={S.listInTransit} />
			</div>
		</Section>
	);
}

function TrackShipment() {
	return (
		<Section
			id="track-shipment"
			eyebrow="Shipments"
			title="Track a shipment"
			aside={
				<>
					<CodeTabs title="GET /shipments/track/:shipment_reference" samples={S.track} />
					<CodeBlock title="Response · 200 (trimmed)" code={S.trackResponse} />
				</>
			}
		>
			<P>
				Get one shipment in full: addresses, items, current <C>status</C> and its <C>tracking_events</C>, newest first.
			</P>
			<Endpoint method="GET" path="/shipments/track/:shipment_reference" auth="store" />
			<P>
				A store key only sees its own store’s shipments — anything else answers <C>404</C>.
			</P>
			<Callout tone="tip" title="Tracking page for your customers">
				No need to build your own. Send customers to <C>https://logistics.obana.africa/?track=&lt;reference&gt;</C> — it’s the <C>tracking_url</C> we return with every shipment.
			</Callout>
		</Section>
	);
}

function CancelShipment() {
	return (
		<Section
			id="cancel-shipment"
			eyebrow="Shipments"
			title="Cancel a shipment"
			aside={
				<>
					<CodeTabs title="POST /shipments/cancel/:shipment_id" samples={S.cancel} />
					<CodeBlock title="Response · 200" code={S.cancelResponse} />
				</>
			}
		>
			<P>
				Cancel an order’s delivery before we collect it. Use the numeric <C>shipment_id</C> from the create response (<C>id</C> in lists), not the reference.
			</P>
			<Endpoint method="POST" path="/shipments/cancel/:shipment_id" auth="store" />
			<Params title="Body" params={[{ name: "reason", type: "string", level: "optional", children: "Why it was cancelled. Kept in the shipment history." }]} />
			<P>
				Only shipments still <C>pending</C> can be cancelled. Later statuses answer <C>400</C>, e.g. <C>Shipment cannot be cancelled in picked_up status</C> — contact support instead.
			</P>
		</Section>
	);
}

function Statuses() {
	const rows: [string, string][] = [
		["pending", "Created and waiting to be confirmed. This is the only status you can cancel from."],
		["confirmed", "Accepted by Obana — a pickup is being arranged."],
		["picked_up", "Collected from your pickup address."],
		["dispatched", "Sent out on its journey to the customer."],
		["in_transit", "On the way to the delivery address."],
		["delivered", "Handed over to the customer. Done."],
		["failed", "The delivery couldn’t be completed. Check the tracking events or contact support."],
		["cancelled", "Cancelled before pickup. Nothing will be delivered."],
		["returned", "Sent back to the pickup address."],
	];
	return (
		<Section id="statuses" eyebrow="Shipments" title="Shipment statuses">
			<P>
				A shipment moves through these statuses. Each change triggers a <C>shipment.updated</C> webhook.
			</P>
			<DefList rows={rows.map(([status, text]) => ({ term: <C>{status}</C>, children: text }))} />
		</Section>
	);
}

function Webhooks() {
	return (
		<Section
			id="webhooks"
			eyebrow="Webhooks"
			title="Receive events"
			aside={
				<>
					<CodeBlock title="Request we send" code={S.webhookRequest} />
					<CodeBlock title="Body" code={S.webhookPayload} />
				</>
			}
		>
			<P>
				Instead of polling, let us tell you when something happens. Set a public <C>https://</C> URL on your store in <strong className="text-ink">Stores & API</strong>; we <C>POST</C> a JSON event to it.
			</P>
			<DefList
				rows={[
					{ term: <C>shipment.created</C>, children: "A shipment was created for your store." },
					{ term: <C>shipment.updated</C>, children: "A shipment’s status changed." },
					{
						term: <C>webhook.test</C>,
						children: (
							<>
								Sent when you press <strong className="text-ink">Send test event</strong>. Its <C>data</C> has a <C>message</C> and your <C>store</C> instead of a shipment.
							</>
						),
					},
				]}
			/>
			<P>
				<C>data.shipment</C> has the same fields as a shipment in <a href="#list-shipments" className={linkClass}>List your shipments</a> (without <C>destination</C>).
			</P>
			<H3>Headers</H3>
			<DefList
				rows={[
					{ term: <C>Obana-Event</C>, children: "The event name, e.g. shipment.updated." },
					{ term: <C>Obana-Delivery</C>, children: "The delivery id. It stays the same when we retry the same event — quote it when you contact support." },
					{
						term: <C>Obana-Signature</C>,
						children: (
							<>
								<C>t=&lt;unix seconds&gt;,v1=&lt;signature&gt;</C>. Always verify it — see <a href="#verify-signatures" className={linkClass}>Verify signatures</a>.
							</>
						),
					},
				]}
			/>
			<H3>Replies and retries</H3>
			<P>
				Answer with any <C>2xx</C> within <strong className="text-ink">8 seconds</strong> — reply first, then do the slow work. If we get anything else (or no answer), we retry after <strong className="text-ink">1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours</strong>, then stop.
			</P>
			<Callout tone="warn" title="Expect repeats and out-of-order events">
				The same event can arrive more than once, and a later update can arrive before an earlier one. Store each event <C>id</C> you’ve handled and skip repeats, and only apply a shipment update if its <C>updated_at</C> is newer than what you have.
			</Callout>
		</Section>
	);
}

function VerifySignatures() {
	return (
		<Section id="verify-signatures" eyebrow="Webhooks" title="Verify signatures" aside={<CodeTabs title="Webhook endpoint" samples={S.verify} />}>
			<P>
				Every event is signed with your store’s webhook secret (starts with <C>whsec_</C>, shown in <strong className="text-ink">Stores & API</strong>). Checking the signature proves the event came from Obana and wasn’t changed.
			</P>
			<Steps
				steps={[
					{ title: "Read the raw body", children: "Use the exact bytes you received. Parsing the JSON and re-encoding it changes the bytes and breaks the check." },
					{
						title: "Split the header",
						children: (
							<>
								From <C>Obana-Signature</C> take <C>t</C> (unix seconds) and <C>v1</C> (hex signature).
							</>
						),
					},
					{
						title: "Compute the expected signature",
						children: (
							<>
								HMAC-SHA256 of <C>&lt;t&gt;.&lt;raw body&gt;</C> with your webhook secret, as hex.
							</>
						),
					},
					{ title: "Compare safely", children: "Use a constant-time comparison, and reject events whose t is more than 5 minutes old so an old event can’t be replayed." },
				]}
			/>
		</Section>
	);
}

function GoLive() {
	const items = [
		<>Your key lives in a server environment variable — not in browser, theme or app code, and not in git.</>,
		<>
			Every create call sends your <C>order_id</C>, so a retry can never book twice.
		</>,
		<>
			You send <C>customer.id</C>, so you can pull up any customer’s shipments.
		</>,
		<>
			Checkout shows the price from <C>/routes/quote</C> and passes the chosen <C>quote_option_id</C>; you quote again after <C>expires_at</C>.
		</>,
		<>
			Errors are handled: <C>400</C> messages reach your team, <C>429</C> waits for <C>Retry-After</C>, <C>5xx</C> retries with backoff.
		</>,
		<>
			Your webhook URL is <C>https://</C>, verifies <C>Obana-Signature</C>, replies <C>2xx</C> within 8 seconds and skips repeated event ids.
		</>,
		<>You sent a test event from the dashboard and saw it arrive.</>,
		<>
			Customers get the <C>tracking_url</C> in their order confirmation.
		</>,
		<>You know where to rotate the key or pause the store if a key ever leaks.</>,
	];
	return (
		<Section id="go-live" eyebrow="Launch" title="Going live checklist">
			<P>Run through this before real orders flow through your integration.</P>
			<ul className="mt-5 space-y-3">
				{items.map((item, i) => (
					<li key={i} className="flex gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm leading-6 text-slate-700">
						<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
						<span className="min-w-0">{item}</span>
					</li>
				))}
			</ul>
		</Section>
	);
}

function Support() {
	return (
		<Section id="support" eyebrow="Launch" title="Support">
			<P>Stuck, or need a route we don’t cover yet? Email us with your store name and, if it’s about a shipment, its reference or the Obana-Delivery id of the webhook.</P>
			<div className="mt-6 flex flex-col gap-3 sm:flex-row">
				<a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700">
					<Mail className="h-4 w-4" aria-hidden />
					{SUPPORT_EMAIL}
				</a>
				<Link href="/onboarding/business" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-slate-50">
					Create your store key
					<ArrowRight className="h-4 w-4" aria-hidden />
				</Link>
			</div>
		</Section>
	);
}

export default function DocsContent() {
	return (
		<div className="pb-16">
			<Hero />
			<Quickstart />
			<Authentication />
			<Responses />
			<Quote />
			<CreateShipment />
			<ListShipments />
			<TrackShipment />
			<CancelShipment />
			<Statuses />
			<Shopify />
			<ZohoOverview />
			<ZohoFields />
			<ZohoGoods />
			<ZohoServices />
			<ZohoTroubleshooting />
			<Webhooks />
			<VerifySignatures />
			<GoLive />
			<Support />
		</div>
	);
}
