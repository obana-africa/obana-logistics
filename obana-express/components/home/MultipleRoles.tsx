"use client";

import React, { useRef, useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

// ─── Role card data ───────────────────────────────────────────────────────────
const roles = [
	{
		id: 1,
		role: "Agents",
		description:
			"Oversee shipments, assist customers, and keep operations running smoothly on the ground.",
		cta: { label: "Get Started", href: "/auth/signup" },
		image: "/deliveryPerson.png",
		imageAlt: "Obana agent checking a package with a clipboard",
		featured: false,
	},
	{
		id: 2,
		role: "Drivers",
		description:
			"Earn by delivering. Accept delivery requests, navigate efficiently, and get paid for every completed job.",
		cta: { label: "Get Started", href: "/auth/signup" },
		image: "/packageOndelivery.png",
		imageAlt: "Obana driver smiling in delivery van",
		featured: true, // center card — taller and elevated
	},
	{
		id: 3,
		role: "Customers",
		description:
			"Create shipments, track deliveries, and manage all your logistics in one place.",
		cta: { label: "Get Started", href: "/auth/signup" },
		image: "/receivePackage.png",
		imageAlt: "Customer receiving a package from an Obana driver",
		featured: false,
	},
];

// ─── Individual role card ─────────────────────────────────────────────────────
function RoleCard({
	role,
	index,
}: {
	role: (typeof roles)[0];
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
			{ threshold: 0.15 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={ref}
			className="group relative rounded-3xl overflow-hidden flex-1"
			style={{
				minHeight: role.featured ? "540px" : "460px",
				marginTop: role.featured ? "0px" : "48px",
				opacity: visible ? 1 : 0,
				transform: visible
					? "translateY(0) scale(1)"
					: `translateY(${role.featured ? "20px" : "32px"}) scale(0.97)`,
				transition: `opacity 0.6s ease ${index * 0.14}s, transform 0.6s ease ${index * 0.14}s`,
				boxShadow: role.featured
					? "0 32px 80px rgba(27,59,95,0.28)"
					: "0 12px 40px rgba(27,59,95,0.12)",
			}}
		>
			{/* ── Background photo ── */}
			<div className="absolute inset-0">
				<Image
					src={role.image}
					alt={role.imageAlt}
					fill
					sizes="(max-width: 768px) 100vw, 33vw"
					className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
					priority={role.featured}
				/>
			</div>

			{/* ── Dark gradient overlay — fades photo into navy at bottom ── */}
			<div
				className="absolute inset-0"
				style={{
					background:
						"linear-gradient(to bottom, rgba(17,17,17,0.0) 0%, rgba(17,17,17,0.1) 35%, rgba(27,59,95,0.75) 60%, rgba(27,59,95,0.97) 100%)",
				}}
			/>

			{/* ── Content pinned to bottom, center aligned, navy bg block ── */}
			<div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-6 pb-7 pt-8"
				style={{
					background: "linear-gradient(to bottom, transparent 0%, rgba(27,59,95,0.98) 30%)",
				}}
			>
				<h3
					className="font-bold text-white mb-2"
					style={{
						fontSize: role.featured ? "1.75rem" : "1.4rem",
						fontFamily: "'Sora', 'DM Sans', sans-serif",
					}}
				>
					{role.role}
				</h3>
				<p
					className="text-sm leading-relaxed mb-5"
					style={{ color: "rgba(255,255,255,0.80)" }}
				>
					{role.description}
				</p>

				<a
					href={role.cta.href}
					className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:gap-3 active:scale-[0.97]"
					style={{
						background: "rgba(255,255,255,0.95)",
						color: "#1b3b5f",
						backdropFilter: "blur(8px)",
					}}
				>
					{role.cta.label}
					<ArrowUpRight className="w-4 h-4" />
				</a>
			</div>
		</div>
	);
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function MultipleRoles() {
	return (
		<section className="py-24 relative overflow-hidden" style={{ background: "#ffffff" }}>
			{/* Subtle background tint */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% 0%, rgba(220,251,249,0.4) 0%, transparent 70%)",
				}}
			/>

			<div className="relative max-w-6xl mx-auto px-6 lg:px-10">
				{/* ── Heading ── */}
				<div className="text-center mb-14">
					<h2
						className="font-black tracking-tight mb-4"
						style={{
							color: "#1b3b5f",
							fontSize: "clamp(2rem, 4vw, 3rem)",
							fontFamily: "'Sora', 'DM Sans', sans-serif",
							lineHeight: 1.1,
						}}
					>
						One Platform. Multiple Roles.
					</h2>
					<p
						className="text-base lg:text-lg max-w-2xl mx-auto leading-relaxed"
						style={{ color: "#49494D" }}
					>
						Whether you're sending, delivering, or managing operations, our
						platform gives you the tools to play your role efficiently.
					</p>
				</div>

				{/* ── Cards row ── */}
				<div className="flex flex-col sm:flex-row gap-5 items-stretch">
					{roles.map((role, index) => (
						<RoleCard key={role.id} role={role} index={index} />
					))}
				</div>
			</div>
		</section>
	);
}
