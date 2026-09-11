// Landing page sections. Server-rendered: no JavaScript ships for these.
// Images are plain <img> on purpose: cld() already asks Cloudinary for the right size and format per screen.
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
	ArrowRight,
	BadgeCheck,
	Bell,
	Boxes,
	Building2,
	Check,
	ChevronDown,
	Code2,
	Globe2,
	Leaf,
	MapPinned,
	Package,
	Plug,
	Route,
	ShieldCheck,
	Smartphone,
	Truck,
	UserRound,
	Wallet,
} from "lucide-react";
import { ActionCard } from "@/components/landing/ActionCard";
import { CopyButton } from "@/components/landing/CopyButton";
import { API_BASE_URL, SUPPORT_EMAIL, cld, cldSet } from "@/lib/site";

const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

function Eyebrow({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
	return (
		<p className={`text-xs font-semibold uppercase tracking-[0.16em] ${tone === "dark" ? "text-amber" : "text-navy-700"}`}>{children}</p>
	);
}

// ─── Hero ────────────────────────────────────────────────────────────────────
export function Hero() {
	return (
		<section className="relative overflow-hidden">
			{/* Soft brand wash + dot grid — pure CSS, nothing to download. */}
			<div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,var(--color-mint)_0%,transparent_70%),radial-gradient(50%_50%_at_0%_100%,#eef3fb_0%,transparent_70%)]" />
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#1b3b5f22_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
			/>
			<div className={`${container} relative grid items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20`}>
				<div>
					<p className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-navy backdrop-blur">
						<Leaf className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
						Electric-vehicle deliveries · Nigeria & across Africa
					</p>
					<h1 className="mt-5 text-[2.6rem] font-bold leading-[1.04] text-ink sm:text-6xl lg:text-[4.1rem]">
						Deliveries that just <span className="text-navy">work</span> — for you and your business.
					</h1>
					<p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
						Send a parcel across town or across states, fulfil your store&apos;s orders in bulk, or plug deliveries straight into your platform. Live tracking and WhatsApp updates at every step.
					</p>
					<div className="mt-7 flex flex-col gap-3 sm:flex-row">
						<Link href="/auth/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-base font-semibold text-white shadow-card transition hover:bg-navy-700">
							Send a package
							<ArrowRight className="h-4 w-4" />
						</Link>
						<Link href="#business" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-6 text-base font-semibold text-ink transition hover:border-navy/30">
							<Building2 className="h-4 w-4" />
							Solutions for business
						</Link>
					</div>
					<ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-muted sm:flex sm:flex-wrap">
						{[
							{ icon: MapPinned, text: "Live tracking" },
							{ icon: Bell, text: "WhatsApp & email updates" },
							{ icon: Wallet, text: "Upfront prices in ₦" },
							{ icon: Plug, text: "API for your platform" },
						].map(({ icon: Icon, text }) => (
							<li key={text} className="flex items-center gap-2">
								<Icon className="h-4 w-4 shrink-0 text-navy" aria-hidden />
								{text}
							</li>
						))}
					</ul>
				</div>
				<div className="lg:pl-4">
					<ActionCard />
				</div>
			</div>
		</section>
	);
}

// ─── Two audiences ───────────────────────────────────────────────────────────
export function Audiences() {
	return (
		<section className="bg-canvas py-16 sm:py-24">
			<div className={container}>
				<div className="max-w-2xl">
					<Eyebrow>One platform, two ways to ship</Eyebrow>
					<h2 className="mt-3 text-3xl font-bold text-ink sm:text-[2.6rem] sm:leading-tight">Whether it&apos;s one parcel or a thousand orders a day.</h2>
				</div>

				<div className="mt-10 grid gap-5 lg:grid-cols-2">
					<article id="individuals" className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-card">
						<img
							src={cld("receivePackage_b1vnmv", 720, "c_fill,ar_16:9,g_auto")}
							srcSet={cldSet("receivePackage_b1vnmv", 720, "c_fill,ar_16:9,g_auto")}
							alt="A customer receiving a package from an Obana rider"
							width={720}
							height={405}
							loading="lazy"
							decoding="async"
							className="aspect-video w-full bg-mint-50 object-cover"
						/>
						<div className="flex flex-1 flex-col p-6 sm:p-8">
							<div className="flex items-center gap-2 text-sm font-semibold text-navy">
								<UserRound className="h-4 w-4" aria-hidden /> For individuals & small sellers
							</div>
							<h3 className="mt-2 text-2xl font-bold text-ink">Send to anyone, track every step.</h3>
							<ul className="mt-5 space-y-3 text-[15px] text-muted">
								{[
									"Book a pickup online — from your home, shop or office",
									"See the price and delivery time before you pay",
									"Share a live tracking link with the person receiving",
									"Great for Instagram, WhatsApp and marketplace sellers",
								].map((t) => (
									<li key={t} className="flex gap-3">
										<Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
										{t}
									</li>
								))}
							</ul>
							<div className="mt-auto flex flex-wrap gap-3 pt-7">
								<Link href="/auth/signup" className="inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white transition hover:bg-navy-700">
									Send a package <ArrowRight className="h-4 w-4" />
								</Link>
								<Link href="/route-match" className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold text-ink transition hover:bg-canvas">
									Get a quote
								</Link>
							</div>
						</div>
					</article>

					<article id="business" className="flex flex-col overflow-hidden rounded-3xl bg-navy text-white shadow-lift">
						<img
							src={cld("shippingContainer_ol8fs9", 720, "c_fill,ar_16:9,g_auto")}
							srcSet={cldSet("shippingContainer_ol8fs9", 720, "c_fill,ar_16:9,g_auto")}
							alt="Shipping containers at a logistics yard"
							width={720}
							height={405}
							loading="lazy"
							decoding="async"
							className="aspect-video w-full bg-navy-900 object-cover opacity-90"
						/>
						<div className="flex flex-1 flex-col p-6 sm:p-8">
							<div className="flex items-center gap-2 text-sm font-semibold text-amber">
								<Building2 className="h-4 w-4" aria-hidden /> For businesses
							</div>
							<h3 className="mt-2 text-2xl font-bold">Fulfilment that scales with your orders.</h3>
							<ul className="mt-5 space-y-3 text-[15px] text-white/75">
								{[
									"Bulk and recurring shipments from one dashboard",
									"Connect your store, ERP or marketplace with our API",
									"Your customers get tracking links, email and WhatsApp updates",
									"Our fleet plus partner carriers for interstate and cross-border routes",
								].map((t) => (
									<li key={t} className="flex gap-3">
										<Check className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
										{t}
									</li>
								))}
							</ul>
							<div className="mt-auto flex flex-wrap gap-3 pt-7">
								<Link href="/onboarding/business" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy transition hover:bg-mint">
									Get an API key <ArrowRight className="h-4 w-4" />
								</Link>
								<a href={`mailto:${SUPPORT_EMAIL}?subject=Business%20deliveries%20with%20Obana`} className="inline-flex h-11 items-center rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
									Talk to our team
								</a>
							</div>
						</div>
					</article>
				</div>
			</div>
		</section>
	);
}

// ─── How it works ────────────────────────────────────────────────────────────
const STEPS = [
	{ icon: Package, title: "Book", text: "Add pickup and drop-off, what you're sending and when — online or through our API." },
	{ icon: Route, title: "We pick the best way", text: "Our own driver for local runs, or a trusted partner carrier for interstate and international routes." },
	{ icon: Smartphone, title: "Track live", text: "Follow the shipment from pickup to door, with WhatsApp and email updates." },
	{ icon: BadgeCheck, title: "Delivered", text: "The receiver gets their package and the delivery is confirmed in your dashboard." },
];

export function HowItWorks() {
	return (
		<section className="py-16 sm:py-24">
			<div className={container}>
				<div className="mx-auto max-w-2xl text-center">
					<Eyebrow>How it works</Eyebrow>
					<h2 className="mt-3 text-3xl font-bold text-ink sm:text-[2.6rem] sm:leading-tight">From booking to doorstep in four steps.</h2>
				</div>
				<ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{STEPS.map(({ icon: Icon, title, text }, i) => (
						<li key={title} className="relative rounded-3xl border border-line bg-white p-6 shadow-card">
							<div className="flex items-center justify-between">
								<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-navy">
									<Icon className="h-5 w-5" aria-hidden />
								</span>
								<span className="font-display text-4xl font-bold text-navy/10">0{i + 1}</span>
							</div>
							<h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
							<p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}

// ─── Developers ──────────────────────────────────────────────────────────────
export function Developers() {
	const snippet = `curl -X POST ${API_BASE_URL}/shipments \\
  -H "Authorization: Bearer OBN-your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pickup_address":   { "line1": "12 Allen Ave", "city": "Ikeja", "state": "Lagos", "country": "Nigeria", "phone": "+2348012345678" },
    "delivery_address": { "line1": "4 Aminu Kano Cres", "city": "Wuse", "state": "FCT", "country": "Nigeria", "phone": "+2349012345678" },
    "items": [{ "name": "Shoes", "quantity": 2, "weight": 1.5 }],
    "transport_mode": "road",
    "service_level": "Standard"
  }'`;

	return (
		<section id="developers" className="relative overflow-hidden bg-navy-950 py-16 text-white sm:py-24">
			<div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-navy-700/40 blur-3xl" />
			<div className={`${container} relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
				<div>
					<Eyebrow tone="dark">For developers</Eyebrow>
					<h2 className="mt-3 text-3xl font-bold sm:text-[2.6rem] sm:leading-tight">Add deliveries to your platform in an afternoon.</h2>
					<p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
						One API key, simple JSON. Create shipments when an order is placed, show tracking in your app, and let Obana keep your customers informed.
					</p>
					<ul className="mt-7 grid gap-4 sm:grid-cols-2">
						{[
							{ icon: Code2, title: "REST API", text: "Create, track and cancel shipments." },
							{ icon: ShieldCheck, title: "API-key auth", text: "One key per business, from your dashboard." },
							{ icon: MapPinned, title: "Tracking links", text: "Send customers a live page for every order." },
							{ icon: Bell, title: "Customer updates", text: "Email and WhatsApp at each stage, handled for you." },
						].map(({ icon: Icon, title, text }) => (
							<li key={title} className="flex gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber">
									<Icon className="h-5 w-5" aria-hidden />
								</span>
								<div>
									<p className="font-semibold">{title}</p>
									<p className="text-sm text-white/60">{text}</p>
								</div>
							</li>
						))}
					</ul>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link href="/onboarding/business" className="inline-flex h-12 items-center gap-2 rounded-full bg-amber px-6 text-base font-semibold text-navy-950 transition hover:brightness-105">
							Get an API key <ArrowRight className="h-4 w-4" />
						</Link>
						<Link href="/docs" className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-base font-semibold text-white transition hover:bg-white/10">
							Read the docs
						</Link>
					</div>
				</div>

				<div className="min-w-0 rounded-2xl border border-white/10 bg-[#07131f] shadow-lift">
					<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
							<span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
							<span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
							<span className="ml-3 font-mono text-xs text-white/50">Create a shipment</span>
						</div>
						<CopyButton text={snippet} />
					</div>
					<pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-sky-100/90 sm:p-5">
						<code>{snippet}</code>
					</pre>
					<div className="border-t border-white/10 px-4 py-3 font-mono text-xs text-emerald-300/90 sm:px-5">
						→ 201 · {"{"} &quot;shipment_reference&quot;: &quot;OBN-20260430-IYU2FXS7&quot;, &quot;status&quot;: &quot;pending&quot; {"}"}
					</div>
				</div>
			</div>
		</section>
	);
}

// ─── Earn with Obana ─────────────────────────────────────────────────────────
export function Earn() {
	const cards = [
		{
			img: "packageOnDelivery_auqffr",
			alt: "An Obana driver in a delivery van",
			icon: Truck,
			title: "Drive with Obana",
			text: "Accept delivery requests near you, follow clear routes and get paid for every completed job.",
			cta: "Become a driver",
		},
		{
			img: "deliveryPerson_cdvibp",
			alt: "An Obana agent checking a package",
			icon: Boxes,
			title: "Become an agent",
			text: "Run operations in your area — oversee shipments, support customers and coordinate drivers.",
			cta: "Become an agent",
		},
	];
	return (
		<section className="py-16 sm:py-24">
			<div className={container}>
				<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div className="max-w-2xl">
						<Eyebrow>Earn with Obana</Eyebrow>
						<h2 className="mt-3 text-3xl font-bold text-ink sm:text-[2.6rem] sm:leading-tight">Grow with the network.</h2>
					</div>
					<p className="max-w-md text-muted">Drivers and agents across Nigeria keep deliveries moving — and earn doing it.</p>
				</div>
				<div className="mt-10 grid gap-5 md:grid-cols-2">
					{cards.map(({ img, alt, icon: Icon, title, text, cta }) => (
						<article key={title} className="group relative isolate flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-3xl p-6 text-white sm:p-8">
							<img
								src={cld(img, 900, "c_fill,ar_4:3,g_auto")}
								srcSet={cldSet(img, 900, "c_fill,ar_4:3,g_auto")}
								alt={alt}
								width={900}
								height={675}
								loading="lazy"
								decoding="async"
								className="absolute inset-0 -z-10 h-full w-full bg-navy-900 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
							/>
							<div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/95 via-navy-950/55 to-transparent" />
							<Icon className="h-6 w-6 text-amber" aria-hidden />
							<h3 className="mt-3 text-2xl font-bold">{title}</h3>
							<p className="mt-2 max-w-md text-white/80">{text}</p>
							<Link href="/auth/signup" className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy transition hover:bg-mint">
								{cta} <ArrowRight className="h-4 w-4" />
							</Link>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}

// ─── Partners ────────────────────────────────────────────────────────────────
const PARTNERS = [
	{ name: "GIG Logistics", logo: "GIG_ywkmfu" },
	{ name: "FedEx", logo: "fedEx_bnnse3" },
	{ name: "Terminal Africa", logo: "Terminal_dheycu" },
	{ name: "C.H. Robinson", logo: "CH_tmbuvt" },
	{ name: "UPS", logo: "UPS_maehg2" },
];

export function Partners() {
	return (
		<section className="border-y border-line bg-canvas py-12">
			<div className={container}>
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-sans text-base font-semibold tracking-normal text-ink">One booking. Our electric fleet plus trusted carrier partners.</h2>
					<p className="mt-1.5 text-sm text-muted">
						Where our own fleet doesn&apos;t reach, we hand your shipment to a partner carrier — you still pay once, track in one place and deal only with Obana.
					</p>
				</div>
				<ul className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
					{PARTNERS.map((p) => (
						<li key={p.name} className="flex h-20 w-[calc(50%-0.375rem)] items-center justify-center rounded-2xl bg-white px-6 ring-1 ring-line sm:w-44 lg:w-52">
							<img src={cld(p.logo, 200, "h_80")} alt={p.name} loading="lazy" decoding="async" className="max-h-10 w-auto object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQS = [
	{
		q: "Can I use Obana if I'm not a business?",
		a: "Yes. Create a free account, book a pickup and pay for your delivery. You'll get a tracking number to follow the package and share with the receiver.",
	},
	{
		q: "How is the price calculated?",
		a: "By distance, weight and size, and the service level you choose (Economy, Standard or Express). You see the full price in naira before you book — no hidden fees.",
	},
	{
		q: "Which areas do you cover?",
		a: "Major cities across Nigeria today, with more routes and cross-border lanes being added. Enter your pickup and delivery addresses when you book and we'll confirm availability instantly.",
	},
	{
		q: "Do you deliver beyond your own fleet?",
		a: "Yes. Alongside our electric fleet, we work with partner carriers for longer interstate and international routes. You book and pay once with Obana, track everything in one place, and we manage the handover.",
	},
	{
		q: "How do I connect Obana to my store or platform?",
		a: "Register your business to get an API key, then create shipments from your backend with a single request. Our API docs include ready-to-use examples in cURL, Node.js and Python.",
	},
	{
		q: "How will I and my customers know where a shipment is?",
		a: "Every shipment has a tracking number and a live tracking page. Status updates are sent by email and WhatsApp when the shipment is created, in transit and delivered.",
	},
	{
		q: "How do drivers and agents join?",
		a: "Sign up, choose driver or agent, and complete verification. Once approved, you'll start receiving delivery requests or operations tasks in your dashboard.",
	},
];

export function FAQ() {
	return (
		<section className="py-16 sm:py-24">
			<div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-8">
				<div>
					<Eyebrow>Questions</Eyebrow>
					<h2 className="mt-3 text-3xl font-bold text-ink sm:text-[2.6rem] sm:leading-tight">Good to know.</h2>
					<p className="mt-4 text-muted">
						Can&apos;t find your answer? Email{" "}
						<a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-navy hover:underline">
							{SUPPORT_EMAIL}
						</a>
						.
					</p>
				</div>
				<div className="divide-y divide-line rounded-3xl border border-line bg-white">
					{FAQS.map((f) => (
						<details key={f.q} className="group p-5 sm:p-6 [&_summary::-webkit-details-marker]:hidden">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-ink">
								{f.q}
								<ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
							</summary>
							<p className="mt-3 leading-relaxed text-muted">{f.a}</p>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}

// ─── Closing call to action ──────────────────────────────────────────────────
export function FinalCta() {
	return (
		<section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
			<div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-navy px-6 py-12 text-center text-white sm:px-12 sm:py-16">
				<div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,#2f5f93_0%,transparent_70%)]" />
				<Globe2 className="relative mx-auto h-8 w-8 text-amber" aria-hidden />
				<h2 className="relative mx-auto mt-4 max-w-2xl text-3xl font-bold sm:text-5xl sm:leading-tight">Ready when you are.</h2>
				<p className="relative mx-auto mt-4 max-w-xl text-lg text-white/75">Send your first package today, or get an API key and start shipping from your platform.</p>
				<div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
					<Link href="/auth/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-navy transition hover:bg-mint">
						Send a package <ArrowRight className="h-4 w-4" />
					</Link>
					<Link href="/onboarding/business" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-base font-semibold text-white transition hover:bg-white/10">
						Get an API key
					</Link>
				</div>
			</div>
		</section>
	);
}
