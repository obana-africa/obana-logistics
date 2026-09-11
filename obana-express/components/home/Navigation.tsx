"use client";

import React, { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui";
import TrackingModal from "@/components/home/TrackingModal";
import { useAuth } from "@/lib/authContext";
import { dashboardFor } from "@/lib/site";

interface NavigationProps {
	isAuthenticated: boolean;
	getDashboardLink: () => string;
	logout: () => void;
}

const NAV_LINKS = [
	{ href: "/#services", label: "Services" },
	{ href: "/#features", label: "Features" },
	{ href: "/docs", label: "Developers" },
	{ href: "/route-match", label: "Get Quote" },
];

const subscribeNothing = () => () => {};
const readTrackParam = () => new URLSearchParams(window.location.search).get("track");

export default function Navigation(props: Partial<NavigationProps> = {}) {
	// Pages may pass the sign-in state; the landing page lets the header read it itself.
	const auth = useAuth();
	const isAuthenticated = props.isAuthenticated ?? auth.isAuthenticated;
	const getDashboardLink = props.getDashboardLink ?? (() => dashboardFor(auth.user));
	const logout = props.logout ?? auth.logout;

	// Sign-in state lives in the browser: show it only after hydration so server and client HTML match.
	const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
	const signedIn = mounted && isAuthenticated;

	// Links in emails and WhatsApp messages arrive as /?track=OBN-… and open tracking straight away.
	const linkedReference = useSyncExternalStore(subscribeNothing, readTrackParam, () => null);
	const [linkDismissed, setLinkDismissed] = useState(false);
	const [trackingOpen, setTrackingOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const fromLink = Boolean(linkedReference) && !linkDismissed;
	const closeTracking = useCallback(() => {
		setTrackingOpen(false);
		setLinkDismissed(true);
	}, []);
	const openTracking = () => {
		setLinkDismissed(true);
		setTrackingOpen(true);
		setMobileMenuOpen(false);
	};

	const linkClass = "text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors";

	return (
		<>
			<nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex items-center justify-between">
					{/* Logo */}
					<Link href="/" className="flex items-center" aria-label="Obana Logistics home">
						<Image src="/logo-blue.png" alt="Obana Logistics" width={140} height={48} className="h-10 w-auto" priority />
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-10">
						{NAV_LINKS.map((l) => (
							<Link key={l.href} href={l.href} className={linkClass}>
								{l.label}
							</Link>
						))}
						<button onClick={openTracking} className={linkClass}>
							Track Shipment
						</button>
					</div>

					{/* Desktop Auth Buttons */}
					<div className="hidden md:flex items-center gap-3">
						{signedIn ? (
							<>
								<Link href={getDashboardLink()}>
									<Button variant="primary" className="bg-[#1B3E5D] hover:bg-[#162f47] text-white px-6">
										Dashboard
									</Button>
								</Link>
								<button onClick={logout} className="text-sm text-slate-600 hover:text-slate-900 font-medium">
									Logout
								</button>
							</>
						) : (
							<>
								<Link href="/auth/login">
									<Button variant="ghost" className="text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 px-5">
										Sign In
									</Button>
								</Link>
								<Link href="/auth/signup">
									<Button variant="primary" className="bg-[#1B3E5D] hover:bg-[#162f47] text-white px-6 text-sm font-medium">
										Get Started
									</Button>
								</Link>
							</>
						)}
					</div>

					{/* Mobile - one button + menu icon */}
					<div className="md:hidden flex items-center gap-3">
						<Link href={signedIn ? getDashboardLink() : "/auth/signup"}>
							<Button variant="primary" size="sm" className="bg-[#1B3E5D] text-white px-5 py-2 text-sm">
								{signedIn ? "Dashboard" : "Get Started"}
							</Button>
						</Link>
						<button
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
							aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
							aria-expanded={mobileMenuOpen}
						>
							{mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
						</button>
					</div>
				</div>

				{/* Mobile Menu Dropdown */}
				{mobileMenuOpen && (
					<div className="md:hidden bg-white border-t border-slate-100 shadow-lg">
						<div className="px-6 py-4 space-y-1">
							{NAV_LINKS.map((l) => (
								<Link key={l.href} href={l.href} className="block rounded-lg px-2 py-3 text-base font-medium text-slate-700 hover:bg-slate-50" onClick={() => setMobileMenuOpen(false)}>
									{l.label}
								</Link>
							))}
							<button onClick={openTracking} className="block w-full rounded-lg px-2 py-3 text-left text-base font-medium text-slate-700 hover:bg-slate-50">
								Track Shipment
							</button>

							{signedIn ? (
								<button
									onClick={() => {
										logout();
										setMobileMenuOpen(false);
									}}
									className="mt-3 block w-full border-t pt-4 text-left text-base font-medium text-rose-600"
								>
									Logout
								</button>
							) : (
								<div className="pt-4 mt-3 border-t space-y-3">
									<Link href="/auth/login" className="block" onClick={() => setMobileMenuOpen(false)}>
										<Button variant="ghost" className="w-full border border-slate-200">
											Sign In
										</Button>
									</Link>
									<Link href="/auth/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
										<Button className="w-full bg-[#1B3E5D] hover:bg-[#162f47] text-white">Get Started</Button>
									</Link>
								</div>
							)}
						</div>
					</div>
				)}
			</nav>

			<TrackingModal open={trackingOpen || fromLink} onClose={closeTracking} reference={fromLink ? (linkedReference ?? undefined) : undefined} />
		</>
	);
}
