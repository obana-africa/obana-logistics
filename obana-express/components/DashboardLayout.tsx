"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	Handshake,
	LayoutDashboard,
	LogOut,
	Menu,
	Package,
	PackagePlus,
	Route,
	ShieldCheck,
	Truck,
	UserRound,
	Users,
	X,
	type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { dashboardFor } from "@/lib/site";

type Role = "customer" | "driver" | "admin" | "agent";

interface DashboardLayoutProps {
	children: React.ReactNode;
	role: Role;
}

type NavItem = { name: string; href: string; icon: LucideIcon };

// Only pages that exist. The first four show in the phone tab bar.
const NAV: Record<Role, NavItem[]> = {
	customer: [
		{ name: "Overview", href: "/dashboard/customer", icon: LayoutDashboard },
		{ name: "New shipment", href: "/dashboard/customer/shipments/new", icon: PackagePlus },
		{ name: "Shipments", href: "/dashboard/customer/shipments", icon: Package },
		{ name: "Account", href: "/dashboard/customer/profile", icon: UserRound },
	],
	driver: [
		{ name: "Deliveries", href: "/dashboard/driver", icon: Truck },
		{ name: "Account", href: "/dashboard/driver/profile", icon: UserRound },
	],
	agent: [
		{ name: "Overview", href: "/dashboard/agent", icon: LayoutDashboard },
		{ name: "Shipments", href: "/dashboard/agent/shipments", icon: Package },
		{ name: "Account", href: "/dashboard/agent/profile", icon: UserRound },
	],
	admin: [
		{ name: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
		{ name: "Shipments", href: "/dashboard/admin/shipments", icon: Package },
		{ name: "Routes & pricing", href: "/dashboard/admin/routes", icon: Route },
		{ name: "Partners", href: "/dashboard/admin/partners", icon: Handshake },
		{ name: "Drivers", href: "/dashboard/admin/drivers", icon: Truck },
		{ name: "Agents", href: "/dashboard/admin/agents", icon: ShieldCheck },
		{ name: "Users", href: "/dashboard/admin/users", icon: Users },
	],
};

const ROLE_LABEL: Record<Role, string> = { customer: "Customer", driver: "Driver", agent: "Agent", admin: "Admin" };

/** The nav item for the current page: the longest href that prefixes the path. */
function activeHref(items: NavItem[], pathname: string) {
	return items
		.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
		.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function initials(first?: string, last?: string, email?: string) {
	const s = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.trim();
	return (s || email?.[0] || "?").toUpperCase();
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
	const { user, isAuthenticated, isLoading, logout } = useAuth();
	const router = useRouter();
	const pathname = usePathname() ?? "";
	const [menuOpen, setMenuOpen] = useState(false);

	const userRole = (user?.account_type ?? (user as { role?: string } | null)?.role) as Role | undefined;
	const wrongRole = !!userRole && userRole !== role && userRole !== "admin";

	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated) router.replace("/auth/login");
		else if (wrongRole) router.replace(dashboardFor(user));
	}, [isLoading, isAuthenticated, wrongRole, user, router]);

	// Close the drawer on Escape and lock page scroll while it is open.
	useEffect(() => {
		if (!menuOpen) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [menuOpen]);

	const items = NAV[role];
	const current = activeHref(items, pathname);
	const first = user?.first_name ?? user?.attributes?.first_name;
	const last = user?.last_name ?? user?.attributes?.last_name;
	const fullName = [first, last].filter(Boolean).join(" ") || user?.email || "Your account";

	const handleLogout = async () => {
		setMenuOpen(false);
		await logout();
		router.replace("/");
	};

	if (isLoading || !isAuthenticated || wrongRole) {
		return (
			<div className="flex min-h-dvh items-center justify-center bg-slate-50" role="status" aria-live="polite">
				<div className="flex flex-col items-center gap-4">
					<Image src="/logo-blue.png" alt="Obana Logistics" width={120} height={51} className="h-9 w-auto" priority />
					<span className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
						<span className="block h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-[#1B3B5F]" />
					</span>
					<span className="sr-only">Loading your dashboard…</span>
				</div>
			</div>
		);
	}

	const accountCard = (
		<div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1B3B5F] text-sm font-bold text-white">{initials(first, last, user?.email)}</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
				<p className="truncate text-xs text-slate-500">{ROLE_LABEL[userRole ?? role]} account</p>
			</div>
		</div>
	);

	const navList = (onNavigate?: () => void) => (
		<ul className="space-y-1">
			{items.map(({ name, href, icon: Icon }) => {
				const active = href === current;
				return (
					<li key={href}>
						<Link
							href={href}
							onClick={onNavigate}
							aria-current={active ? "page" : undefined}
							className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
								active ? "bg-[#1B3B5F] text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
							}`}
						>
							<Icon className="h-5 w-5 shrink-0" aria-hidden />
							{name}
						</Link>
					</li>
				);
			})}
		</ul>
	);

	const tabs = items.slice(0, 4);

	return (
		<div className="min-h-dvh bg-slate-50">
			{/* Desktop sidebar */}
			<aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
				<Link href="/" className="flex h-16 items-center px-6" aria-label="Obana Logistics home">
					<Image src="/logo-blue.png" alt="Obana Logistics" width={120} height={51} className="h-9 w-auto" priority />
				</Link>
				<nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
					{navList()}
				</nav>
				<div className="space-y-2 border-t border-slate-100 p-3">
					{accountCard}
					<button
						type="button"
						onClick={handleLogout}
						className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
					>
						<LogOut className="h-5 w-5" aria-hidden /> Sign out
					</button>
				</div>
			</aside>

			{/* Phone top bar */}
			<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
				<Link href="/" aria-label="Obana Logistics home">
					<Image src="/logo-blue.png" alt="Obana Logistics" width={100} height={43} className="h-8 w-auto" priority />
				</Link>
				<button
					type="button"
					onClick={() => setMenuOpen(true)}
					aria-label="Open account menu"
					className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B3B5F] text-xs font-bold text-white"
				>
					{initials(first, last, user?.email)}
				</button>
			</header>

			<main className="px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">
				<div className="mx-auto max-w-6xl">{children}</div>
			</main>

			{/* Phone tab bar */}
			<nav
				aria-label="Dashboard"
				className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
			>
				<ul className="flex">
					{tabs.map(({ name, href, icon: Icon }) => {
						const active = href === current;
						return (
							<li key={href} className="flex-1">
								<Link
									href={href}
									aria-current={active ? "page" : undefined}
									className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-[#1B3B5F]" : "text-slate-500"}`}
								>
									<Icon className={`h-5 w-5 ${active ? "stroke-[2.4]" : ""}`} aria-hidden />
									<span className="max-w-full truncate px-1">{name}</span>
								</Link>
							</li>
						);
					})}
					<li className="flex-1">
						<button
							type="button"
							onClick={() => setMenuOpen(true)}
							aria-expanded={menuOpen}
							className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-500"
						>
							<Menu className="h-5 w-5" aria-hidden />
							Menu
						</button>
					</li>
				</ul>
			</nav>

			{/* Phone drawer */}
			{menuOpen && (
				<div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
					<button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
					<div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
						<div className="mb-4 flex items-center justify-between">
							<p className="text-base font-semibold text-slate-900">Menu</p>
							<button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100">
								<X className="h-5 w-5" />
							</button>
						</div>
						{accountCard}
						<nav aria-label="All pages" className="mt-4">
							{navList(() => setMenuOpen(false))}
						</nav>
						<button
							type="button"
							onClick={handleLogout}
							className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
						>
							<LogOut className="h-5 w-5" aria-hidden /> Sign out
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
