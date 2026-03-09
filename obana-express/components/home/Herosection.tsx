"use client";

import React, { useState, useEffect } from "react";
import { Search, ChevronDown, X, MapPin, Truck } from "lucide-react";
import { Loader, Button, Badge } from "@/components/ui";
import { apiClient } from "@/lib/api";
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

const getStatusVariant = (status: string) => {
	switch (status?.toLowerCase()) {
		case 'delivered': return 'success';
		case 'in_transit': return 'info';
		case 'pending': return 'warning';
		case 'cancelled':
		case 'returned': return 'error';
		default: return 'default';
	}
};

export default function HeroSection() {
	const [currentSlide, setCurrentSlide] = useState(0);
	const [trackingId, setTrackingId] = useState("");
	const [trackingResult, setTrackingResult] = useState<any>(null);
	const [trackingError, setTrackingError] = useState<string | null>(null);
	const [trackingLoading, setTrackingLoading] = useState(false);
	const [showTrackingModal, setShowTrackingModal] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
		}, 5000);
		return () => clearInterval(interval);
	}, []);

	const handleTrackShipment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (trackingId.trim()) {
			setTrackingLoading(true);
			setTrackingError(null);
			setTrackingResult(null);
			setShowTrackingModal(true);
			try {
				const res = await apiClient.getShipment(trackingId.trim());
				if (res.success) {
					setTrackingResult(res.data);
				} else {
					setTrackingError(res.message || 'Not found');
				}
			} catch (err: any) {
				setTrackingError(err.response?.data?.message || 'Failed to fetch');
			}
			setTrackingLoading(false);
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
						to and from Anywhere in The world
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
							placeholder="Enter your tracking ID (e.g., OBN-123456789NG)"
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
			</div>

			{/* Tracking Result Modal */}
			{showTrackingModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left">
						<button
							onClick={() => setShowTrackingModal(false)}
							className="absolute top-5 right-5 text-slate-400 hover:text-black"
						>
							<X className="w-6 h-6" />
						</button>

						{trackingLoading ? (
							<div className="flex justify-center py-12"><Loader /></div>
						) : trackingError ? (
							<div className="text-center py-8">
								<div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
									<X className="w-8 h-8 text-red-600" />
								</div>
								<h3 className="text-lg font-bold text-slate-900 mb-2">Tracking Failed</h3>
								<p className="text-red-600 mb-6">{trackingError}</p>
								<Button 
									variant="secondary" 
									className="w-full"
									onClick={() => setShowTrackingModal(false)}
								>
									Close
								</Button>
							</div>
						) : trackingResult ? (
							<div className="space-y-6">
								<div className="flex justify-between items-start border-b pb-4">
									<div>
										<p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Shipment Reference</p>
										<h3 className="text-lg font-bold text-slate-900">{trackingResult.shipment_reference}</h3>
									</div>
									<Badge variant={getStatusVariant(trackingResult.status)}>
										{trackingResult.status?.replace('_', ' ').toUpperCase()}
									</Badge>
								</div>

								<div className="grid grid-cols-2 gap-6">
									<div>
										<div className="flex items-center text-slate-500 mb-1">
											<MapPin className="w-4 h-4 mr-1" />
											<span className="text-xs font-medium uppercase">Origin</span>
										</div>
										<p className="font-medium text-slate-900">
											{trackingResult.pickup_address?.city}, {trackingResult.pickup_address?.state}
										</p>
									</div>
									<div>
										<div className="flex items-center text-slate-500 mb-1">
											<MapPin className="w-4 h-4 mr-1" />
											<span className="text-xs font-medium uppercase">Destination</span>
										</div>
										<p className="font-medium text-slate-900">
											{trackingResult.delivery_address?.city}, {trackingResult.delivery_address?.state}
										</p>
									</div>
								</div>

								<div className="bg-slate-50 p-4 rounded-xl space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-slate-500">Service Level</span>
										<span className="font-medium text-slate-900">{trackingResult.service_level}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-slate-500">Transport Mode</span>
										<span className="font-medium text-slate-900 capitalize">{trackingResult.transport_mode}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-slate-500">Total Items</span>
										<span className="font-medium text-slate-900">{trackingResult.total_items}</span>
									</div>
								</div>

								{trackingResult.tracking_events && trackingResult.tracking_events.length > 0 && (
									<div>
										<h4 className="font-semibold text-slate-900 mb-4 flex items-center">
											<Truck className="w-4 h-4 mr-2" />
											Tracking History
										</h4>
										<div className="space-y-0 relative border-l-2 border-slate-200 ml-2 pl-6 py-2 max-h-60 overflow-y-auto">
											{trackingResult.tracking_events
												.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
												.map((event: any, index: number) => (
												<div key={event.id} className="relative mb-6 last:mb-0">
													<div className={`absolute -left-7.75 top-1.5 w-3 h-3 rounded-full border-2 border-white ${index === 0 ? 'bg-blue-600 ring-2 ring-blue-100' : 'bg-slate-300'}`} />
													<div className="flex flex-col">
														<span className="text-sm font-bold text-slate-900">
															{event.status.replace('_', ' ').toUpperCase()}
														</span>
														<span className="text-xs text-slate-500 mb-1">
															{new Date(event.createdAt).toLocaleString()}
														</span>
														{event.description && (
															<span className="text-sm text-slate-600">
																{event.description}
															</span>
														)}
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								<Button 
									variant="secondary" 
									className="w-full"
									onClick={() => { setShowTrackingModal(false); setTrackingResult(null); setTrackingId(""); }}
								>
									Track Another Shipment
								</Button>
							</div>
						) : null}
					</div>
				</div>
			)}
		</section>
	);
}
