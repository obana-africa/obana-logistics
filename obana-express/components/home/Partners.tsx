"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";

// ─── Partner data ─────────────────────────────────────────────────────────────
const partners = [
	{
		id: 1,
		name: "GIG Logistics",
		logo: "/GIG.png",
		width: 120,
		height: 60,
	},
	{
		id: 2,
		name: "FedEx Logistics",
		logo: "/FedEx.png",
		width: 140,
		height: 56,
	},
	{
		id: 3,
		name: "Terminal",
		logo: "/Terminal.png",
		width: 140,
		height: 48,
	},
	{
		id: 4,
		name: "C.H. Robinson",
		logo: "/CH.png",
		width: 160,
		height: 44,
	},
	{
		id: 5,
		name: "UPS",
		logo: "/UPS.png",
		width: 72,
		height: 80,
	},
];

// Duplicate for two rows with different ordering so they feel distinct
const rowOne = [...partners, ...partners]; // GIG, FedEx, Terminal, CH Robinson, UPS × 2
const rowTwo = [...[...partners].reverse(), ...[...partners].reverse()]; // reversed × 2

// ─── Scroll-triggered section visibility ─────────────────────────────────────
function useVisible(threshold = 0.1) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
			},
			{ threshold }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [threshold]);
	return { ref, visible };
}

// ─── Single logo card ─────────────────────────────────────────────────────────
function LogoCard({ partner }: { partner: (typeof partners)[0] }) {
	return (
		<div
			className="flex-shrink-0 flex items-center justify-center rounded-2xl mx-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default"
			style={{
				width: "220px",
				height: "110px",
				background: "#ffffff",
				border: "1.5px solid #ecedf0",
				padding: "20px 28px",
			}}
		>
			<div className="relative flex items-center justify-center w-full h-full">
				<Image
					src={partner.logo}
					alt={partner.name}
					width={partner.width}
					height={partner.height}
					className="object-contain max-w-full max-h-full"
					style={{ filter: "grayscale(0%)" }}
				/>
			</div>
		</div>
	);
}

// ─── Infinite marquee row ─────────────────────────────────────────────────────
function MarqueeRow({
	items,
	direction = "left",
	speed = 35,
}: {
	items: (typeof partners)[0][];
	direction?: "left" | "right";
	speed?: number;
}) {
	// CSS keyframe direction
	const animName = direction === "left" ? "marquee-left" : "marquee-right";

	return (
		<div className="overflow-hidden w-full relative">
			{/* Fade edges */}
			<div
				className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none"
				style={{ background: "linear-gradient(to right, #f8f9fb, transparent)" }}
			/>
			<div
				className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none"
				style={{ background: "linear-gradient(to left, #f8f9fb, transparent)" }}
			/>

			<div
				className="flex"
				style={{
					animation: `${animName} ${speed}s linear infinite`,
					width: "max-content",
				}}
			>
				{/* Render items twice for seamless loop */}
				{[...items, ...items].map((partner, i) => (
					<LogoCard key={`${partner.id}-${i}`} partner={partner} />
				))}
			</div>
		</div>
	);
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function Partners() {
	const { ref, visible } = useVisible();

	return (
		<>
			{/* Inject keyframe animations */}
			<style>{`
				@keyframes marquee-left {
					0%   { transform: translateX(0); }
					100% { transform: translateX(-50%); }
				}
				@keyframes marquee-right {
					0%   { transform: translateX(-50%); }
					100% { transform: translateX(0); }
				}
			`}</style>

			<section
				className="py-20 overflow-hidden"
				style={{ background: "#f8f9fb" }}
			>
				<div className="max-w-7xl mx-auto px-6 lg:px-10">
					{/* ── Heading ── */}
					<div
						ref={ref}
						className="text-center mb-14"
						style={{
							opacity: visible ? 1 : 0,
							transform: visible ? "translateY(0)" : "translateY(20px)",
							transition: "opacity 0.6s ease, transform 0.6s ease",
						}}
					>
						<h2
							className="font-black tracking-tight"
							style={{
								color: "#1b3b5f",
								fontSize: "clamp(2rem, 4.5vw, 3rem)",
								fontFamily: "'Sora', 'DM Sans', sans-serif",
								lineHeight: 1.1,
							}}
						>
							We Work With The Best Partners
						</h2>
						<p
							className="mt-4 text-base lg:text-lg max-w-xl mx-auto leading-relaxed"
							style={{ color: "#49494D" }}
						>
							Trusted by leading logistics companies across Africa and beyond.
						</p>
					</div>
				</div>

				{/* ── Row 1: scrolls left ── */}
				<div className="mb-5">
					<MarqueeRow items={rowOne} direction="left" speed={40} />
				</div>

				{/* ── Row 2: scrolls right ── */}
				<div>
					<MarqueeRow items={rowTwo} direction="right" speed={50} />
				</div>

				{/* ── Static 2×4 grid (visible on print / no-JS) — hidden by default ── */}
				<noscript>
					<div className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
						{partners.map((p) => (
							<LogoCard key={p.id} partner={p} />
						))}
					</div>
				</noscript>
			</section>
		</>
	);
}
