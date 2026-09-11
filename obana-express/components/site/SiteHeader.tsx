"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { dashboardFor } from "@/lib/site";

const subscribeNothing = () => () => {};

const LINKS = [
	{ href: "/#individuals", label: "Send a package" },
	{ href: "/#business", label: "For business" },
	{ href: "/#developers", label: "Developers" },
	{ href: "/route-match", label: "Get a quote" },
];

/** Sticky header. Sign-in state comes from the browser, so it appears after load instead of blocking the page. */
export function SiteHeader() {
	const { isAuthenticated, user } = useAuthStore();
	// False on the server and during hydration, true in the browser — avoids a sign-in flash mismatch.
	const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const signedIn = mounted && isAuthenticated;

	return (
		<header
			className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
				scrolled || open ? "border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75" : "border-transparent bg-transparent"
			}`}
		>
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<Link href="/" aria-label="Obana Logistics home" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy">
					<Image src="/logo-blue.png" alt="Obana Logistics" width={120} height={48} priority className="h-9 w-auto" />
				</Link>

				<nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
					{LINKS.map((l) => (
						<Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-ink">
							{l.label}
						</Link>
					))}
				</nav>

				<div className="flex items-center gap-2">
					<Link href="/#track" className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-navy transition-colors hover:bg-mint sm:inline-flex">
						Track
					</Link>
					{signedIn ? (
						<Link href={dashboardFor(user)} className="inline-flex h-10 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-700">
							Dashboard
						</Link>
					) : (
						<>
							<Link href="/auth/login" className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas sm:inline-flex">
								Sign in
							</Link>
							<Link href="/auth/signup" className="inline-flex h-10 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-700">
								Get started
							</Link>
						</>
					)}
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						aria-expanded={open}
						aria-controls="mobile-menu"
						aria-label={open ? "Close menu" : "Open menu"}
						className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas lg:hidden"
					>
						{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</div>

			{open && (
				<div id="mobile-menu" className="border-t border-line bg-white lg:hidden">
					<nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
						{[{ href: "/#track", label: "Track a shipment" }, ...LINKS].map((l) => (
							<Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-canvas">
								{l.label}
							</Link>
						))}
						{!signedIn && (
							<Link href="/auth/login" onClick={() => setOpen(false)} className="mt-2 rounded-xl border border-line px-3 py-3 text-center text-base font-semibold text-ink">
								Sign in
							</Link>
						)}
					</nav>
				</div>
			)}
		</header>
	);
}
