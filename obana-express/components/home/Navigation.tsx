"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Loader, Badge } from "@/components/ui";
import { Package, Search, X, MapPin, Truck } from "lucide-react";
import { apiClient } from "@/lib/api";

interface NavigationProps {
	isAuthenticated: boolean;
	getDashboardLink: () => string;
	logout: () => void;
}

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

export default function Navigation({
	isAuthenticated,
	getDashboardLink,
	logout,
}: NavigationProps) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [scrolled, setScrolled] = useState(false);
	const [showTrackingModal, setShowTrackingModal] = useState(false);
	const [trackingId, setTrackingId] = useState("");
	const [trackingResult, setTrackingResult] = useState<any>(null);
	const [trackingError, setTrackingError] = useState<string | null>(null);
	const [trackingLoading, setTrackingLoading] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 20);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleTrackShipment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (trackingId.trim()) {
			setTrackingLoading(true);
			setTrackingError(null);
			setTrackingResult(null);
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
			setShowTrackingModal(true);
		}
	};

	return (
		<>
			<nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
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
						<Link
							href="/docs"
							className="font-medium text-black hover:text-amber-600 transition-colors"
						>
							Developers
						</Link>
						<Link
							href="/route-match"
							className="font-medium text-black hover:text-amber-600 transition-colors"
						>
							Get Quote
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
								<Link href="/onboarding/business">
									<Button variant="ghost" className="text-black">
										For Businesses
									</Button>
								</Link>
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
							<Link
								href="/docs"
								className="block text-black hover:text-amber-600 font-medium"
								onClick={() => setMobileMenuOpen(false)}
							>
								Developers
							</Link>
							<Link
						href="/route-match"
						className="block text-black hover:text-amber-600 font-medium"
						onClick={() => setMobileMenuOpen(false)}
					>
						Route Match
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
										href="/onboarding/business"
										className="block"
										onClick={() => setMobileMenuOpen(false)}
									>
										<Button variant="ghost" className="w-full">
											For Businesses
										</Button>
									</Link>
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

			{/* Tracking Modal */}
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

{trackingResult || trackingError ? (
						<div className="space-y-4">
							<button
								onClick={() => { setShowTrackingModal(false); setTrackingResult(null); setTrackingError(null); }}
								className="absolute top-5 right-5 text-slate-400 hover:text-black"
							>
								<X className="w-6 h-6" />
							</button>
							{trackingLoading ? (
								<div className="flex justify-center py-8"><Loader /></div>
							) : trackingError ? (
								<p className="text-red-600 text-center">{trackingError}</p>
							) : (
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
										onClick={() => { setTrackingResult(null); setTrackingId(""); }}
									>
										Track Another Shipment
									</Button>
								</div>
							)}
						</div>
					) : (
						<form onSubmit={handleTrackShipment} className="space-y-5">
							<div>
								<label className="block text-sm font-medium text-black mb-2">
									Tracking ID
								</label>
								<input
									type="text"
									value={trackingId}
									onChange={(e) => setTrackingId(e.target.value)}
									placeholder="e.g., OBN-123456789NG"
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
					)}

						<p className="text-sm text-slate-500 text-center mt-6">
							Don&apos;t have a tracking ID?{" "}
							<Link
								href="/dashboard/customer/shipments/new"
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
