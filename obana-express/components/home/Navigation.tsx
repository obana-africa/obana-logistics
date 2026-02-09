"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";
import { Package, Search, X, Menu } from "lucide-react";

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
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 20); // smaller threshold since bg is always there
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleTrackShipment = (e: React.FormEvent) => {
		e.preventDefault();
		if (trackingId.trim()) {
			console.log("Tracking ID:", trackingId);
			// router.push(`/track/${trackingId}`);
			setShowTrackingModal(false);
			setTrackingId("");
		}
	};

	return (
		<>
			<nav
				className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white shadow-sm`}
			>
				<div className="max-w-7xl mx-auto px-5  py-4 flex items-center justify-between">
					{/* Logo */}
					<Link href="/" className="flex items-center">
						<Image
							src="/logo.svg"
							alt="Obana Logistics Logo"
							width={140}
							height={48}
							className="h-10 w-auto"
							priority
						/>
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-8">
						<Link
							href="#services"
							className="font-medium text-black hover:text-amber-600 transition-colors"
						>
							Services
						</Link>
						<Link
							href="#features"
							className="font-medium text-black hover:text-amber-600 transition-colors"
						>
							Features
						</Link>
						<button
							onClick={() => setShowTrackingModal(true)}
							className="font-medium text-black hover:text-amber-600 transition-colors"
						>
							Track Shipment
						</button>
					</div>

					{/* Desktop Auth Buttons */}
					<div className="hidden md:flex items-center space-x-4">
						{isAuthenticated ? (
							<>
								<Link href={getDashboardLink()}>
									<Button
										variant="primary"
										className="bg-blue-600 hover:bg-blue-700 text-white px-6"
									>
										Dashboard
									</Button>
								</Link>
								<button
									onClick={logout}
									className="text-slate-600 hover:text-slate-900 font-medium"
								>
									Logout
								</button>
							</>
						) : (
							<>
								<Link href="/auth/login">
									<Button variant="ghost" className="text-black">
										Sign In
									</Button>
								</Link>
								<Link href="/auth/signup">
									<Button
										variant="primary"
										className="bg-[#1B3E5D] text-slate-900 px-6"
									>
										Get Started
									</Button>
								</Link>
							</>
						)}
					</div>

					{/* Mobile - only one button + menu icon */}
					<div className="md:hidden flex items-center gap-3">
						{isAuthenticated ? (
							<Link href={getDashboardLink()}>
								<Button
									variant="primary"
									size="sm"
									className=" text-white px-5 py-2 text-sm"
								>
									Dashboard
								</Button>
							</Link>
						) : (
							<Link href="/auth/signup">
								<Button
									variant="primary"
									size="sm"
									className="bg-[#1B3E5D] text-slate-900 px-5 py-2 text-sm"
								>
									Get Started
								</Button>
							</Link>
						)}

						{/* <button
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							className="text-black p-1"
						>
							<Menu className="h-7 w-7" />
						</button> */}
					</div>
				</div>

				{/* Mobile Menu Dropdown */}
				{mobileMenuOpen && (
					<div className="md:hidden bg-white border-t shadow-lg">
						<div className="px-5 py-6 space-y-5">
							<Link
								href="#services"
								className="block text-black hover:text-amber-600 font-medium"
								onClick={() => setMobileMenuOpen(false)}
							>
								Services
							</Link>
							<Link
								href="#features"
								className="block text-black hover:text-amber-600 font-medium"
								onClick={() => setMobileMenuOpen(false)}
							>
								Features
							</Link>
							<button
								onClick={() => {
									setShowTrackingModal(true);
									setMobileMenuOpen(false);
								}}
								className="block text-black hover:text-amber-600 font-medium w-full text-left"
							>
								Track Shipment
							</button>

							{/* Mobile auth actions */}
							{isAuthenticated ? (
								<button
									onClick={() => {
										logout();
										setMobileMenuOpen(false);
									}}
									className="block text-black hover:text-slate-900 font-medium w-full text-left pt-4 border-t"
								>
									Logout
								</button>
							) : (
								<div className="pt-4 border-t space-y-4">
									<Link
										href="/auth/login"
										className="block"
										onClick={() => setMobileMenuOpen(false)}
									>
										<Button variant="ghost" className="w-full">
											Sign In
										</Button>
									</Link>
									<Link
										href="/auth/signup"
										className="block"
										onClick={() => setMobileMenuOpen(false)}
									>
										<Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900">
											Get Started
										</Button>
									</Link>
								</div>
							)}
						</div>
					</div>
				)}
			</nav>

			{/* Tracking Modal - unchanged */}
			{showTrackingModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-99 flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
						<button
							onClick={() => setShowTrackingModal(false)}
							className="absolute top-5 right-5 text-slate-400 hover:text-black"
						>
							<X className="w-6 h-6" />
						</button>

						<div className="flex items-center justify-center w-16 h-16 bg-blue-900 rounded-2xl mx-auto mb-6">
							<Package className="w-8 h-8 text-white" />
						</div>

						<h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
							Track Your Shipment
						</h2>
						<p className="text-slate-600 text-center mb-8">
							Enter your tracking ID to get real-time updates
						</p>

						<form onSubmit={handleTrackShipment} className="space-y-5">
							<div>
								<label className="block text-sm font-medium text-black mb-2">
									Tracking ID
								</label>
								<input
									type="text"
									value={trackingId}
									onChange={(e) => setTrackingId(e.target.value)}
									placeholder="e.g., OB123456789NG"
									className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
									required
								/>
							</div>

							<Button
								type="submit"
								className="w-full bg-[#1B3E5D] text-white py-3 rounded-xl font-medium"
							>
								<Search className="w-5 h-5 mr-2" />
								Track Package
							</Button>
						</form>

						<p className="text-sm text-slate-500 text-center mt-6">
							Don&apos;t have a tracking ID?{" "}
							<Link
								href="/auth/signup"
								className="text-blue-600 hover:underline font-medium"
								onClick={() => setShowTrackingModal(false)}
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
