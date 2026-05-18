"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Facebook, Instagram, Twitter, Linkedin, Send } from "lucide-react";
import Image from "next/image";

// ─── Nav columns data ─────────────────────────────────────────────────────────
const footerColumns = [
	{
		heading: "Services",
		links: [
			{ label: "Express Delivery", href: "#" },
			{ label: "Interstate Shipping", href: "#" },
			{ label: "Business Solutions", href: "#" },
			{ label: "Get Quote", href: "/route-match" },
			{ label: "Track Package", href: "/track" },
		],
	},
	{
		heading: "Company",
		links: [
			{ label: "About Us", href: "#" },
			{ label: "Careers", href: "#" },
			{ label: "Blog", href: "#" },
			{ label: "Contact", href: "/contact" },
		],
	},
	{
		heading: "Developers",
		links: [
			{ label: "API Docs", href: "/developers" },
			{ label: "Webhooks", href: "#" },
			{ label: "SDKs", href: "#" },
			{ label: "Changelog", href: "#" },
		],
	},
	{
		heading: "Legal",
		links: [
			{ label: "Privacy Policy", href: "#" },
			{ label: "Terms of Service", href: "#" },
			{ label: "Shipping Policy", href: "#" },
			{ label: "Refund Policy", href: "#" },
		],
	},
];

const socialLinks = [
	{ label: "Facebook",  href: "https://facebook.com",  Icon: Facebook  },
	{ label: "Instagram", href: "https://instagram.com", Icon: Instagram },
	{ label: "Twitter",   href: "https://twitter.com",   Icon: Twitter   },
	{ label: "LinkedIn",  href: "https://linkedin.com",  Icon: Linkedin  },
];

// ─── Newsletter form ──────────────────────────────────────────────────────────
function NewsletterForm() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (email.trim()) {
			setSent(true);
			setEmail("");
			setTimeout(() => setSent(false), 4000);
		}
	};

	return (
		<div>
			<h4 className="font-bold text-sm mb-1.5" style={{ color: "#ffffff" }}>
				Stay Connected
			</h4>
			<p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
				Subscribe for updates on sourcing opportunities, vendor programs, and
				African market trends.
			</p>

			{sent ? (
				<p className="text-sm font-semibold" style={{ color: "#22c55e" }}>
					✓ You&apos;re subscribed!
				</p>
			) : (
				<form onSubmit={handleSubmit} className="flex">
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Enter your email..."
						required
						className="flex-1 px-4 py-3 text-sm focus:outline-none rounded-l-xl"
						style={{
							background: "rgba(255,255,255,0.1)",
							color: "#ffffff",
							border: "1px solid rgba(255,255,255,0.15)",
							borderRight: "none",
						}}
					/>
					<button
						type="submit"
						aria-label="Subscribe"
						className="px-4 py-3 rounded-r-xl flex items-center justify-center transition-all hover:bg-white/20"
						style={{
							background: "rgba(255,255,255,0.12)",
							border: "1px solid rgba(255,255,255,0.15)",
							borderLeft: "none",
						}}
					>
						<Send className="w-4 h-4 text-white" />
					</button>
				</form>
			)}
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
					fontFamily: "'Sora', 'DM Sans', sans-serif",
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
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-6 pb-8"
					style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
				>
					{/* Brand + social */}
					<div className="col-span-2 sm:col-span-1 flex flex-col gap-4">
						<Link href="/" className="inline-block">
							{logoError ? (
								<TextLogo />
							) : (
								<Image
									src="/white-logo.svg"
									alt="Obana Logistics"
									width={90}
									height={44}
									className="object-contain"
									style={{ width: '94px', height: 'auto' }}
									onError={() => setLogoError(true)}
								/>
							)}
						</Link>

						{/* Social icons row */}
						<div className="flex items-center gap-2">
							{socialLinks.map(({ label, href, Icon }) => (
								<Link
									key={label}
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={label}
									className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-white/20"
									style={{ background: "rgba(255,255,255,0.1)" }}
								>
									<Icon className="w-3.5 h-3.5 text-white opacity-80" />
								</Link>
							))}
						</div>
					</div>

					{/* Nav columns */}
					{footerColumns.map((col) => (
						<div key={col.heading}>
							<h4
								className="font-bold text-sm mb-2"
								style={{ color: "#ffffff" }}
							>
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

				{/* ── Bottom bar: copyright left + newsletter right ── */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6">
					{/* Copyright */}
					<div className="space-y-1.5">
						<p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
							&copy; {currentYear} Obana.Africa (An ICON Tech &amp; Ecom Services Ltd Trademark).
							<br />
							All Rights Reserved.
						</p>
						<div className="flex items-center gap-3">
							{["Terms & Conditions", "Privacy Policy"].map((item, i) => (
								<React.Fragment key={item}>
									{i > 0 && (
										<span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
									)}
									<Link
										href="#"
										className="text-xs hover:text-white transition-colors duration-150"
										style={{ color: "rgba(255,255,255,0.4)" }}
									>
										{item}
									</Link>
								</React.Fragment>
							))}
						</div>
					</div>

					{/* Newsletter */}
					<div className="md:max-w-sm md:ml-auto w-full">
						<NewsletterForm />
					</div>
				</div>
			</div>
		</footer>
	);
}
