"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import Image from "next/image";
import { SUPPORT_EMAIL } from "@/lib/site";

// ─── Nav columns data — only links that lead somewhere real ──────────────────
const footerColumns = [
	{
		heading: "Services",
		links: [
			{ label: "Create Shipment", href: "/auth/signup" },
			{ label: "Get Quote", href: "/route-match" },
			{ label: "Track Package", href: "/#track" },
			{ label: "How It Works", href: "/#services" },
		],
	},
	{
		heading: "Company",
		links: [
			{ label: "Become a Driver", href: "/auth/signup" },
			{ label: "Become an Agent", href: "/auth/signup" },
			{ label: "Contact", href: `mailto:${SUPPORT_EMAIL}` },
		],
	},
	{
		heading: "Developers",
		links: [
			{ label: "API Docs", href: "/docs" },
			{ label: "Get API Key", href: "/onboarding/business" },
		],
	},
	{
		heading: "Account",
		links: [
			{ label: "Sign In", href: "/auth/login" },
			{ label: "Create Account", href: "/auth/signup" },
		],
	},
];

// ─── Contact block (replaces the newsletter form, which never saved anything) ─
function ContactBlock() {
	return (
		<div>
			<h4 className="font-bold text-sm mb-1.5" style={{ color: "#ffffff" }}>
				Stay Connected
			</h4>
			<p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
				Questions about deliveries, business accounts or integrations? Our team replies by email.
			</p>
			<a
				href={`mailto:${SUPPORT_EMAIL}`}
				className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:bg-white/20"
				style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)" }}
			>
				<Mail className="w-4 h-4" />
				{SUPPORT_EMAIL}
			</a>
		</div>
	);
}

// ─── Text logo fallback (shown if SVG fails) ──────────────────────────────────
function TextLogo() {
	return (
		<div className="flex flex-col">
			<span
				style={{
					fontSize: "1.75rem",
					fontWeight: 900,
					color: "#ffffff",
					fontFamily: "var(--font-display)",
					letterSpacing: "-0.03em",
					lineHeight: 1,
				}}
			>
				obana
			</span>
			<span
				style={{
					fontSize: "0.6rem",
					color: "#f59e0b",
					fontWeight: 600,
					letterSpacing: "0.18em",
					textTransform: "uppercase",
					marginTop: "2px",
				}}
			>
				Logistics
			</span>
		</div>
	);
}

// ─── Main Footer ──────────────────────────────────────────────────────────────
export default function Footer() {
	const currentYear = new Date().getFullYear();
	const [logoError, setLogoError] = useState(false);

	return (
		<footer className="relative text-white" style={{ background: "#1b3b5f" }}>
			<div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-8">
				{/* ── Top grid: logo + 4 nav columns ── */}
				<div
					className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-6 pb-8"
					style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
				>
					{/* Brand */}
					<div className="col-span-2 sm:col-span-1 flex flex-col gap-4">
						<Link href="/" className="inline-block">
							{logoError ? (
								<TextLogo />
							) : (
								// The Obana Logistics logo turned white (white-logo.svg is the marketplace logo with a different tagline).
								<Image
									src="/logo-blue.png"
									alt="Obana Logistics"
									width={120}
									height={51}
									className="h-11 w-auto object-contain brightness-0 invert"
									onError={() => setLogoError(true)}
								/>
							)}
						</Link>
						<p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
							EV-powered fulfilment for businesses across Africa — with an API for your platform.
						</p>
					</div>

					{/* Nav columns */}
					{footerColumns.map((col) => (
						<div key={col.heading}>
							<h4 className="font-bold text-sm mb-2" style={{ color: "#ffffff" }}>
								{col.heading}
							</h4>
							<ul className="space-y-1">
								{col.links.map((link) => (
									<li key={link.label}>
										<Link
											href={link.href}
											className="text-sm transition-colors duration-150 hover:text-white"
											style={{ color: "rgba(255,255,255,0.5)" }}
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				{/* ── Bottom bar: copyright left + contact right ── */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6">
					<p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
						&copy; {currentYear} Obana.Africa (An ICON Tech &amp; Ecom Services Ltd Trademark).
						<br />
						All Rights Reserved.
					</p>
					<div className="md:max-w-sm md:ml-auto w-full">
						<ContactBlock />
					</div>
				</div>
			</div>
		</footer>
	);
}
