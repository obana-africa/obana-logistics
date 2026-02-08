"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";
import { Package, Search, X } from "lucide-react";

interface NavigationProps {
	isAuthenticated: boolean;
	getDashboardLink: () => string;
	logout: () => void;
}

export default function Navigation({
	isAuthenticated,
	getDashboardLink,
	logout,
}: NavigationProps) {
	const [scrolled, setScrolled] = useState(false);
	const [showTrackingModal, setShowTrackingModal] = useState(false);
	const [trackingId, setTrackingId] = useState("");

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 50);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleTrackShipment = (e: React.FormEvent) => {
		e.preventDefault();
		if (trackingId.trim()) {
			// Navigate to tracking page or handle tracking logic
			console.log("Tracking ID:", trackingId);
			// router.push(`/track/${trackingId}`);
			setShowTrackingModal(false);
			setTrackingId("");
		}
	};

	return (
		<>
			<nav
				className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
					scrolled ? "bg-[#f4f4f4] shadow-lg" : "bg-transparent"
				}`}
			>
				<div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
					<Link
						href="/"
						className="flex items-center bg-[#f4f4f4] rounded-lg px-3 py-2"
					>
						<Image
							src="/logo.svg"
							alt="Obana Logistics Logo"
							width={100}
							height={100}
							className="ml-2"
						/>
					</Link>

					<div className="hidden md:flex items-center space-x-8">
						<Link
							href="#services"
							className={`font-medium transition-colors hover:text-amber-500 ${
								scrolled ? "text-slate-600" : "text-white/90"
							}`}
						>
							Services
						</Link>
						<Link
							href="#features"
							className={`font-medium transition-colors hover:text-amber-500 ${
								scrolled ? "text-slate-600" : "text-white/90"
							}`}
						>
							Features
						</Link>
						<button
							onClick={() => setShowTrackingModal(true)}
							className={`font-medium transition-colors hover:text-amber-500 ${
								scrolled ? "text-slate-600" : "text-white/90"
							}`}
						>
							Track Shipment
						</button>
					</div>

					<div className="flex items-center space-x-3">
						{isAuthenticated ? (
							<>
								<Link href={getDashboardLink()}>
									<Button
										variant="primary"
										className="bg-blue-600 hover:bg-blue-700 text-white"
									>
										Dashboard
									</Button>
								</Link>
								<Button
									variant="ghost"
									onClick={() => logout()}
									className={scrolled ? "text-slate-600" : "text-white"}
								>
									Logout
								</Button>
							</>
						) : (
							<>
								<Link href="/auth/login">
									<Button
										// variant="ghost"
										className={
											scrolled
												? "text-slate-600"
												: "text-white hover:text-white/80"
										}
									>
										Sign In
									</Button>
								</Link>
								<Link href="/auth/signup">
									<Button
										variant="primary"
										className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
									>
										Get Started
									</Button>
								</Link>
							</>
						)}
					</div>
				</div>
			</nav>

			{/* Tracking Modal */}
			{showTrackingModal && (
				<div className="fixed inset-0 bg-black/50 backdrop-blur-sm  z-99 flex items-center justify-center p-4">
					<div className="bg-amber-50 rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-scale-in">
						<button
							onClick={() => setShowTrackingModal(false)}
							className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
						>
							<X className="w-6 h-6" />
						</button>

						<div className="flex items-center justify-center w-16 h-16  bg-[#1B3E5D] rounded-2xl mx-auto mb-6 shadow-lg shadow-blue-500/30">
							<Package className="w-8 h-8 text-white" />
						</div>

						<h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
							Track Your Shipment
						</h2>
						<p className="text-slate-600 text-center mb-6">
							Enter your tracking ID to get real-time updates
						</p>

						<form onSubmit={handleTrackShipment} className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-slate-700 mb-2">
									Tracking ID
								</label>
								<input
									type="text"
									value={trackingId}
									onChange={(e) => setTrackingId(e.target.value)}
									placeholder="e.g., OB123456789NG"
									className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
									required
								/>
							</div>

							<Button
								type="submit"
								className="w-full bg-#1B3E5D hover:bg-blue-700 text-white font-semibold py-3 rounded-xl"
							>
								<Search className="w-5 h-5 mr-2" />
								Track Package
							</Button>
						</form>

						<p className="text-sm text-slate-500 text-center mt-4">
							Don't have a tracking ID?{" "}
							<Link
								href="/auth/signup"
								className="text-#1B3E5D hover:underline"
							>
								Create a shipment
							</Link>
						</p>
					</div>
				</div>
			)}
		</>
	);
}
