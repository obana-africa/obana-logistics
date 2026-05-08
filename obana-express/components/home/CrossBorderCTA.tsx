"use client";

import React, { useRef, useEffect, useState } from "react";
import { ArrowUpRight, Check, Package, Truck } from "lucide-react";
import Image from "next/image";
import { CldImage } from "next-cloudinary";

// ─── Shipment success card data (dynamic) ────────────────────────────────────
const shipmentCard = {
	title: "Shipment Created!",
	subtitle: "Your shipment has been created successfully.",
	details: [
		{ label: "Tracking #", value: "OBN-20260430-IYU2FXS7" },
		{ label: "Carrier", value: "Obana Logistics" },
		{ label: "Status", value: "Pending" },
	],
	actions: [
		{ label: "Track Shipment", href: "/auth/signup", primary: true },
		{ label: "Create Another Shipment", href: "/auth/signup", primary: false },
	],
};

// ─── Scroll-triggered visibility hook ────────────────────────────────────────
function useVisible(threshold = 0.15) {
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
			{ threshold }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [threshold]);
	return { ref, visible };
}

// ─── Shipment success card ────────────────────────────────────────────────────
function ShipmentCard({ visible }: { visible: boolean }) {
	return (
		<div
			className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-auto lg:mx-0"
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.97)",
				transition: "opacity 0.65s ease 0.25s, transform 0.65s ease 0.25s",
				boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
			}}
		>
			{/* Green check circle */}
			<div className="flex justify-center mb-5">
				<div
					className="w-14 h-14 rounded-full flex items-center justify-center"
					style={{ background: "rgba(34,197,94,0.15)" }}
				>
					<div
						className="w-10 h-10 rounded-full flex items-center justify-center"
						style={{ background: "rgba(34,197,94,0.25)" }}
					>
						<Check className="w-5 h-5" style={{ color: "#22c55e" }} strokeWidth={3} />
					</div>
				</div>
			</div>

			{/* Title */}
			<h3
				className="text-center font-black mb-1.5"
				style={{
					color: "#111111",
					fontSize: "1.3rem",
					fontFamily: "'Sora', 'DM Sans', sans-serif",
				}}
			>
				{shipmentCard.title}
			</h3>
			<p className="text-center text-sm mb-5" style={{ color: "#49494D" }}>
				{shipmentCard.subtitle}
			</p>

			{/* Details box */}
			<div
				className="rounded-xl p-4 mb-5 space-y-2"
				style={{ background: "#f7f8fa", border: "1px solid #ecedf0" }}
			>
				{shipmentCard.details.map((detail) => (
					<div key={detail.label} className="flex items-baseline gap-1.5">
						<span
							className="text-sm font-semibold shrink-0"
							style={{ color: "#49494D" }}
						>
							{detail.label}:
						</span>
						<span
							className="text-sm truncate"
							style={{
								color: detail.label === "Status" ? "#f59e0b" : "#9A9DAF",
								fontWeight: detail.label === "Status" ? 600 : 400,
							}}
						>
							{detail.value}
						</span>
					</div>
				))}
			</div>

			{/* Action buttons */}
			<div className="flex flex-col gap-3">
				{shipmentCard.actions.map((action) => (
					<a
						key={action.label}
						href={action.href}
						className="w-full flex items-center justify-center py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
						style={
							action.primary
								? { background: "#1b3b5f", color: "#ffffff" }
								: { background: "#ecedf0", color: "#1b3b5f" }
						}
					>
						{action.label}
					</a>
				))}
			</div>
		</div>
	);
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function CrossBorderCTA() {
	const { ref, visible } = useVisible(0.1);

	return (
		<section
			ref={ref}
			className="relative overflow-hidden"
			style={{ minHeight: "520px" }}
		>
			{/* ── Background image ── */}
			<div className="absolute inset-0">
				<CldImage
					src="shippingContainer_ol8fs9"
					alt="Shipping containers background"
					fill
					className="object-cover object-center"
					priority
				/>
				{/* Dark navy overlay — matches Figma: deep #1b3b5f tint at ~75% opacity */}
				<div
					className="absolute inset-0"
					style={{
						background:
							"linear-gradient(105deg, rgba(17,30,50,0.88) 0%, rgba(27,59,95,0.80) 45%, rgba(27,59,95,0.60) 100%)",
					}}
				/>
			</div>

			{/* ── Content ── */}
			<div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 py-20 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

				{/* LEFT — copy */}
				<div
					className="flex-1 max-w-lg"
					style={{
						opacity: visible ? 1 : 0,
						transform: visible ? "translateX(0)" : "translateX(-28px)",
						transition: "opacity 0.65s ease, transform 0.65s ease",
					}}
				>
					{/* Eyebrow pill */}
					<span
						className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6"
						style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b" }}
					>
						<Package className="w-3.5 h-3.5" />
						Cross-Border Logistics
					</span>

					<h2
						className="font-black leading-[1.05] tracking-tight mb-6"
						style={{
							color: "#f59e0b",
							fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)",
							fontFamily: "'Sora', 'DM Sans', sans-serif",
						}}
					>
						Cross-Border <br />
						Logistics Made Easy
					</h2>

					<p
						className="text-base lg:text-lg leading-relaxed mb-10"
						style={{ color: "rgba(255,255,255,0.78)" }}
					>
						Manage imports and exports with full visibility, reliable delivery,
						and simplified processes all in one platform.
					</p>

					{/* CTA buttons */}
					<div className="flex flex-wrap gap-4">
						<a
							href="/auth/signup"
							className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
							style={{ background: "#ffffff", color: "#1b3b5f" }}
						>
							Get Started
						</a>
						<a
							href="/create-shipment"
							className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
							style={{
								color: "#ffffff",
								border: "1.5px solid rgba(255,255,255,0.5)",
								background: "transparent",
							}}
						>
							Create Shipment
							<ArrowUpRight className="w-4 h-4" />
						</a>
					</div>

					{/* Trust badges */}
					<div className="flex items-center gap-6 mt-8">
						{[
							{ icon: Truck, label: "Same-day delivery" },
							{ icon: Check, label: "Fully insured" },
						].map(({ icon: Icon, label }) => (
							<div key={label} className="flex items-center gap-2">
								<div
									className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
									style={{ background: "rgba(34,197,94,0.2)" }}
								>
									<Icon className="w-3 h-3" style={{ color: "#22c55e" }} strokeWidth={2.5} />
								</div>
								<span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
									{label}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* RIGHT — shipment card */}
				<div className="shrink-0 w-full lg:w-auto">
					<ShipmentCard visible={visible} />
				</div>
			</div>
		</section>
	);
}
