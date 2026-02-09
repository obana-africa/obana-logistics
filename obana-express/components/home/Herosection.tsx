"use client";

import React, { useState, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui";

const heroSlides = [
	{
		title: "Gifts & Personal Items",
		image: "/images/hero-1.webp",
		fallbackGradient: "from-purple-600 via-pink-600 to-red-600",
	},
	{
		title: "Business Packages",
		image: "/images/hero-2.webp",
		fallbackGradient: "from-blue-600 via-indigo-600 to-purple-600",
	},
	{
		title: "Documents & Letters",
		image: "/images/hero-1.webp",
		fallbackGradient: "from-teal-600 via-cyan-600 to-blue-600",
	},
	{
		title: "Electronics & Gadgets",
		image: "/images/hero-1.webp",
		fallbackGradient: "from-slate-700 via-slate-600 to-blue-600",
	},
];

export default function HeroSection() {
	const [currentSlide, setCurrentSlide] = useState(0);
	const [trackingId, setTrackingId] = useState("");

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
		}, 5000);
		return () => clearInterval(interval);
	}, []);

	const handleTrackShipment = (e: React.FormEvent) => {
		e.preventDefault();
		if (trackingId.trim()) {
			console.log("Tracking:", trackingId);
			// router.push(`/track/${trackingId}`);
		}
	};

	return (
		<section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
			<div className="absolute inset-0">
				{heroSlides.map((slide, index) => (
					<div
						key={index}
						className={`absolute inset-0 transition-opacity duration-1000 ${
							index === currentSlide ? "opacity-100" : "opacity-0"
						}`}
					>
						{/* Image */}
						<div
							className="absolute inset-0 bg-cover bg-center"
							style={{
								backgroundImage: `url(${slide.image})`,
							}}
						/>

						<div className="absolute inset-0 bg-[#1B3E5D]/70" />
					</div>
				))}

				{/* Animated Overlay Elements */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
					<div
						className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse"
						style={{ animationDelay: "1s" }}
					/>
					<div
						className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
						style={{ animationDelay: "2s" }}
					/>
				</div>
			</div>

			{/* Content */}
			<div className="relative max-w-6xl mx-auto px-6 py-32 text-center z-10">
				<div className="inline-block mb-6 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full backdrop-blur-sm animate-fade-in">
					<span className="text-amber-400 font-medium text-sm">
						🚀 Fast, Reliable & Secure Shipping
					</span>
				</div>

				<h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in-up">
					Send and Receive
					<br />
					<span className="text-transparent bg-clip-text bg-linear-to-r from-amber-400 via-amber-300 to-yellow-400 transition-all duration-1000">
						{heroSlides[currentSlide].title}
					</span>
					<br />
					<span className="text-4xl md:text-6xl">
						to and from Anywhere in Nigeria
					</span>
				</h1>

				<p className="text-xl hidden md:block text-slate-300 max-w-3xl mx-auto mb-12 animate-fade-in delay-200">
					The modern platform for shipping, tracking, and managing deliveries.
					Join thousands of businesses and individuals who trust Obana for their
					logistics needs.
				</p>

				{/* Tracking Input */}
				<div className="max-w-2xl mx-auto mb-16 animate-fade-in-up delay-300">
					<form
						onSubmit={handleTrackShipment}
						className="relative bg-white rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2"
					>
						<input
							type="text"
							value={trackingId}
							onChange={(e) => setTrackingId(e.target.value)}
							placeholder="Enter your tracking ID (e.g., OB123456789NG)"
							className="flex-1 px-6 py-4 text-slate-900 placeholder-slate-400 bg-transparent border-0 focus:outline-none text-base"
						/>
						<Button
							type="submit"
							variant="primary"
							className="  text-white  px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
						>
							<Search className="w-5 h-5 mr-2" />
							Track Shipment
						</Button>
					</form>
					<p className="text-sm text-white/70 mt-3">
						Real-time tracking • Instant notifications • 24/7 support
					</p>
				</div>

				{/* Slide Indicators */}
				<div className="flex justify-center gap-2 mt-12">
					{heroSlides.map((_, index) => (
						<button
							key={index}
							onClick={() => setCurrentSlide(index)}
							className={`w-2 h-2 rounded-full transition-all ${
								index === currentSlide
									? "bg-amber-400 w-8"
									: "bg-white/40 hover:bg-white/60"
							}`}
							aria-label={`Go to slide ${index + 1}`}
						/>
					))}
				</div>

				{/* Scroll Indicator */}
				<div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
					<ChevronDown className="w-8 h-8 text-white/60" />
				</div>
			</div>
		</section>
	);
}
