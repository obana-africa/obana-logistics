"use client";

import React, { useRef, useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

// ─── Feature card data ────────────────────────────────────────────────────────
const features = [
	{
		id: 1,
		title: "Ship in Minutes, Not Hours",
		description: "Create and manage deliveries whether you're sending a single package or handling bulk shipments for your business.",
		cta: { label: "Create Shipment", href: "/auth/signup" },
		image: "/createShipPhone.png",
		imageAlt: "Create shipment screen on mobile",
		cardBg: "#f5f9ff",
		phoneAnchor: "top",
		overlay: null as string | null,
	},
	{
		id: 2,
		title: "Know Where Every Package Is",
		description: "Track shipments live with accurate updates, ensuring transparency from pickup to delivery.",
		cta: { label: "Get Started", href: "/auth/signup" },
		image: "/shipmentPhone.png",
		imageAlt: "Shipment tracking screen on mobile",
		cardBg: "#f5f9ff",
		phoneAnchor: "top",
		overlay: null as string | null,
	},
	{
		id: 3,
		title: "Plug Logistics Into Your Platform",
		description: "Integrate our API into your platform to automate shipping, tracking, and order fulfillment—no manual work needed.",
		cta: { label: "Get Started", href: "/auth/signup" },
		image: "/developerPhone.png",
		imageAlt: "Developer API settings screen on mobile",
		cardBg: "#f5f9ff",
		phoneAnchor: "bottom",
		overlay: null as string | null,
	},
	{
		id: 4,
		title: "One Platform. Multiple Ways to Earn & Operate.",
		description: "Whether you're sending, delivering, or managing logistics—there's a role for you.",
		cta: { label: "Get Started", href: "/auth/signup" },
		image: "/obanaPhone.png",
		imageAlt: "Obana platform roles screen on mobile",
		cardBg: "#f5f9ff",
		phoneAnchor: "top",
		overlay: "/obanaWebCard.png" as string | null,
	},
];

// ─── Individual feature card ──────────────────────────────────────────────────
function FeatureCard({
	feature,
	index,
}: {
	feature: (typeof features)[0];
	index: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.1 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const isTop = feature.phoneAnchor === "top";

	return (
		<div
			ref={ref}
			className="group relative rounded-3xl flex flex-col"
			style={{
				background: feature.cardBg,
				opacity: visible ? 1 : 0,
				transform: visible ? "translateY(0)" : "translateY(28px)",
				transition: `opacity 0.55s ease ${index * 0.12}s, transform 0.55s ease ${index * 0.12}s`,
				overflow: "hidden",
			}}
		>
			{/* Phone image zone */}
			<div className="relative w-full overflow-hidden h-60 sm:h-70 md:h-85 lg:h-95">

				{/* Glow */}
				<div
					className="absolute inset-0 pointer-events-none"
					style={{
						background: "radial-gradient(ellipse 90% 70% at 50% 15%, rgba(27,59,95,0.07) 0%, transparent 70%)",
					}}
				/>

				{/* Phone anchored top or bottom */}
				<div
					className="absolute left-1/2 w-full flex justify-center"
					style={{
						transform: "translateX(-50%)",
						top: isTop ? 0 : "auto",
						bottom: isTop ? "auto" : 0,
						paddingTop: isTop ? "20px" : "0px",
					}}
				>
					<Image
						src={feature.image}
						alt={feature.imageAlt}
						width={300}
						height={600}
						className="group-hover:scale-[1.02] transition-transform duration-500"
						style={{
							width: "70%",
							height: "auto",
							maxWidth: "320px",
							objectFit: "contain",
							objectPosition: isTop ? "top" : "bottom",
							filter: "drop-shadow(0 12px 28px rgba(27,59,95,0.16))",
						}}
					/>
				</div>

				{/* Overlay — card 4 only, shifted left off edge */}
				{feature.overlay && (
					<div
						className="absolute"
						style={{
							bottom: "16px",
							left: "-16px",
							width: "55%",
							zIndex: 10,
							filter: "drop-shadow(0 8px 24px rgba(27,59,95,0.25))",
						}}
					>
						<Image
							src={feature.overlay}
							alt="Obana web interface"
							width={400}
							height={320}
							className="w-full h-auto rounded-2xl"
						/>
					</div>
				)}

			</div>

			{/* Text + CTA */}
			<div className="px-2 pb-7 pt-4 flex flex-col items-center text-center">
				<h3
					className="font-bold leading-snug mb-2"
					style={{
						color: "#2e465f",
						fontSize: "clamp(1.2rem, 2vw, 1.4rem)",
						fontFamily: "'Sora', 'DM Sans', sans-serif",
					}}
				>
					{feature.title}
				</h3>
				<p
					className="text-sm leading-relaxed mb-5 max-w-xs"
					style={{ color: "#49494D" }}
				>
					{feature.description}
				</p>
				<a
					href={feature.cta.href}
					className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
					style={{ background: "#1b3b5f" }}
				>
					{feature.cta.label}
					<ArrowUpRight className="w-4 h-4" />
				</a>
			</div>
		</div>
	);
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function QuickActions() {
	return (
		<section
			className="pt-10 pb-24 relative overflow-hidden"
			style={{ background: "#ffffff" }}
		>
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div
					className="absolute -top-24 right-0 w-125 h-125 rounded-full blur-3xl"
					style={{ background: "rgba(220,251,249,0.45)" }}
				/>
				<div
					className="absolute bottom-0 left-0 w-100 h-100 rounded-full blur-3xl"
					style={{ background: "rgba(27,59,95,0.04)" }}
				/>
			</div>

			<div className="relative max-w-7xl mx-auto px-6 lg:px-10">
				<div className="text-center mb-16">
					<p
						className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4"
						style={{ background: "#dcfbf9", color: "#1b3b5f" }}
					>
						Mobile App
					</p>
					<h2
						className="font-black tracking-tight mb-4"
						style={{
							color: "#1b3b5f",
							fontSize: "clamp(2rem, 4vw, 3rem)",
							fontFamily: "'Sora', 'DM Sans', sans-serif",
							lineHeight: 1.1,
						}}
					>
						A Smarter Way to Manage Logistics
					</h2>
					<p
						className="text-base lg:text-lg max-w-2xl mx-auto leading-relaxed"
						style={{ color: "#49494D" }}
					>
						From shipment creation to real-time tracking and seamless
						integrations, our platform gives you the tools to move faster and
						operate smarter.
					</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					{features.map((feature, index) => (
						<FeatureCard key={feature.id} feature={feature} index={index} />
					))}
				</div>
			</div>
		</section>
	);
}
