"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const faqs = [
	{
		id: 1,
		question: "How do I create a shipment?",
		answer:
			"Creating a shipment is simple. Sign up, enter your pickup and delivery details, choose your preferred options, and confirm your request is instantly processed.",
	},
	{
		id: 2,
		question: "Do you support business or bulk deliveries?",
		answer:
			"Yes! Obana is built B2B-first. You can manage bulk shipments, set recurring deliveries, and access a dedicated dashboard for your business operations. Our platform scales with your volume — from a single parcel to hundreds of orders per day.",
	},
	{
		id: 3,
		question: "How do drivers get started?",
		answer:
			"Drivers can sign up on the platform, complete a quick verification process, and start accepting delivery requests immediately. You'll receive job notifications, navigate with built-in routing, and get paid per completed delivery.",
	},
	{
		id: 4,
		question: "How secure is the platform?",
		answer:
			"Security is a top priority. All transactions are encrypted, payments are processed through verified gateways, and every shipment is tracked end-to-end. Your data and packages are always protected.",
	},
	{
		id: 5,
		question: "What role do agents play on the platform?",
		answer:
			"Agents are operations managers on the ground. They oversee shipments in their zone, assist customers with issues, coordinate drivers, and ensure deliveries run smoothly. Agents have access to a dedicated operations dashboard.",
	},
	{
		id: 6,
		question: "What areas do you currently cover?",
		answer:
			"We currently operate across major cities in Nigeria with rapid expansion underway. Enter your pickup and delivery addresses when creating a shipment and our system will confirm route availability instantly.",
	},
	{
		id: 7,
		question: "How is pricing calculated?",
		answer:
			"Pricing is based on distance, package weight/dimensions, and your selected service level (standard, express, or same-day). You'll see a full quote before confirming any shipment — no hidden fees.",
	},
];

// ─── Animated answer panel ────────────────────────────────────────────────────
function AnswerPanel({ answer, open }: { answer: string; open: boolean }) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);

	useEffect(() => {
		if (contentRef.current) {
			setHeight(open ? contentRef.current.scrollHeight : 0);
		}
	}, [open]);

	return (
		<div
			style={{
				height: `${height}px`,
				overflow: "hidden",
				transition: "height 0.35s cubic-bezier(0.4,0,0.2,1)",
			}}
		>
			<div ref={contentRef} className="pt-3 pb-1">
				<p
					className="text-base leading-relaxed"
					style={{ color: "#49494D" }}
				>
					{answer}
				</p>
			</div>
		</div>
	);
}

// ─── Single FAQ item ──────────────────────────────────────────────────────────
function FAQItem({
	faq,
	isOpen,
	onToggle,
	index,
	visible,
}: {
	faq: (typeof faqs)[0];
	isOpen: boolean;
	onToggle: () => void;
	index: number;
	visible: boolean;
}) {
	return (
		<div
			className="rounded-2xl overflow-hidden transition-all duration-300"
			style={{
				background: isOpen ? "#ffffff" : "#f0f4f8",
				border: isOpen ? "1.5px solid rgba(27,59,95,0.15)" : "1.5px solid transparent",
				boxShadow: isOpen ? "0 4px 24px rgba(27,59,95,0.08)" : "none",
				opacity: visible ? 1 : 0,
				transform: visible ? "translateY(0)" : "translateY(20px)",
				transition: `opacity 0.5s ease ${index * 0.07}s, transform 0.5s ease ${index * 0.07}s, background 0.2s, border 0.2s, box-shadow 0.2s`,
			}}
		>
			<button
				onClick={onToggle}
				className="w-full flex items-center justify-between px-7 py-5 text-left group"
				aria-expanded={isOpen}
			>
				<span
					className="font-semibold pr-6 leading-snug"
					style={{
						color: "#1b3b5f",
						fontSize: "clamp(1rem, 1.8vw, 1.1rem)",
						fontFamily: "'Sora', 'DM Sans', sans-serif",
					}}
				>
					{faq.question}
				</span>

				<span
					className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
					style={{
						background: isOpen ? "#1b3b5f" : "rgba(27,59,95,0.1)",
					}}
				>
					{isOpen ? (
						<ChevronUp className="w-4 h-4 text-white" />
					) : (
						<ChevronDown className="w-4 h-4" style={{ color: "#1b3b5f" }} />
					)}
				</span>
			</button>

			<div className="px-7 pb-0">
				<AnswerPanel answer={faq.answer} open={isOpen} />
				{isOpen && <div className="pb-5" />}
			</div>
		</div>
	);
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function FAQ() {
	const [openId, setOpenId] = useState<number>(1); // first item open by default
	const sectionRef = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = sectionRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.08 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const toggle = (id: number) => {
		setOpenId((prev) => (prev === id ? -1 : id));
	};

	return (
		<section className="py-24 relative overflow-hidden" style={{ background: "#ffffff" }}>
			{/* Subtle background tint */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 70% 40% at 50% 0%, rgba(220,251,249,0.4) 0%, transparent 70%)",
				}}
			/>

			<div ref={sectionRef} className="relative max-w-3xl mx-auto px-6 lg:px-8">
				{/* ── Heading ── */}
				<div
					className="text-center mb-14"
					style={{
						opacity: visible ? 1 : 0,
						transform: visible ? "translateY(0)" : "translateY(20px)",
						transition: "opacity 0.6s ease, transform 0.6s ease",
					}}
				>
					<p
						className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4"
						style={{ background: "#dcfbf9", color: "#1b3b5f" }}
					>
						Support
					</p>
					<h2
						className="font-black tracking-tight mb-4"
						style={{
							color: "#1b3b5f",
							fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
							fontFamily: "'Sora', 'DM Sans', sans-serif",
							lineHeight: 1.1,
						}}
					>
						Frequently Asked Questions
					</h2>
					<p
						className="text-base lg:text-lg leading-relaxed"
						style={{ color: "#49494D" }}
					>
						Everything you need to know about Obana Logistics. Can't find your
						answer?{" "}
						<a
							href="/contact"
							className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
							style={{ color: "#1b3b5f" }}
						>
							Contact us
						</a>
						.
					</p>
				</div>

				{/* ── Accordion list ── */}
				<div className="flex flex-col gap-3">
					{faqs.map((faq, index) => (
						<FAQItem
							key={faq.id}
							faq={faq}
							isOpen={openId === faq.id}
							onToggle={() => toggle(faq.id)}
							index={index}
							visible={visible}
						/>
					))}
				</div>

				{/* ── Bottom CTA ── */}
				{/* <div
					className="mt-14 text-center rounded-2xl px-8 py-8"
					style={{
						background: "#1b3b5f",
						opacity: visible ? 1 : 0,
						transform: visible ? "translateY(0)" : "translateY(20px)",
						transition: "opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s",
					}}
				>
					<p
						className="font-semibold mb-1"
						style={{ color: "rgba(255,255,255,0.9)", fontSize: "1.05rem" }}
					>
						Still have questions?
					</p>
					<p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.6)" }}>
						Our support team is available 24/7 to help you.
					</p>
					<a
						href="/contact"
						className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
						style={{ background: "#ffffff", color: "#1b3b5f" }}
					>
						Get in Touch
					</a>
				</div> */}
			</div>
		</section>
	);
}
