import React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { statusMeta, type Tone } from "@/lib/shipments";

// Building blocks shared by the customer, driver, agent and admin dashboards.

const display = { fontFamily: "var(--font-display)" } as const;

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				<h1 className="text-2xl font-bold text-slate-900 sm:text-3xl" style={display}>
					{title}
				</h1>
				{description && <p className="mt-1 text-slate-600">{description}</p>}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
		</div>
	);
}

/** A link styled like the primary/secondary button (never wrap a <button> in a <Link>). */
export function ButtonLink({
	href,
	children,
	icon: Icon,
	variant = "primary",
}: {
	href: string;
	children: React.ReactNode;
	icon?: React.ElementType;
	variant?: "primary" | "secondary";
}) {
	return (
		<Link
			href={href}
			className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20 ${
				variant === "primary" ? "bg-[#1B3B5F] text-white hover:bg-[#15304d]" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
			}`}
		>
			{Icon && <Icon className="h-4 w-4" aria-hidden />}
			{children}
		</Link>
	);
}

const TONE_CLASSES: Record<Tone, string> = {
	neutral: "bg-slate-100 text-slate-700 ring-slate-200",
	info: "bg-sky-50 text-sky-800 ring-sky-200",
	progress: "bg-indigo-50 text-indigo-800 ring-indigo-200",
	success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	danger: "bg-rose-50 text-rose-800 ring-rose-200",
	warning: "bg-amber-50 text-amber-900 ring-amber-200",
};

const TONE_DOT: Record<Tone, string> = {
	neutral: "bg-slate-400",
	info: "bg-sky-500",
	progress: "bg-indigo-500",
	success: "bg-emerald-500",
	danger: "bg-rose-500",
	warning: "bg-amber-500",
};

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
	return (
		<span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
			<span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
			{children}
		</span>
	);
}

export function StatusBadge({ status }: { status?: string | null }) {
	const meta = statusMeta(status);
	return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

const STAT_ICON: Record<Tone, string> = {
	neutral: "bg-slate-100 text-slate-700",
	info: "bg-sky-50 text-sky-700",
	progress: "bg-indigo-50 text-indigo-700",
	success: "bg-emerald-50 text-emerald-700",
	danger: "bg-rose-50 text-rose-700",
	warning: "bg-amber-50 text-amber-700",
};

export function StatCard({
	label,
	value,
	icon: Icon,
	tone = "neutral",
	hint,
	loading,
}: {
	label: string;
	value: React.ReactNode;
	icon: React.ElementType;
	tone?: Tone;
	hint?: string;
	loading?: boolean;
}) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<p className="text-sm font-medium text-slate-600">{label}</p>
				<span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${STAT_ICON[tone]}`}>
					<Icon className="h-5 w-5" aria-hidden />
				</span>
			</div>
			{loading ? (
				<div className="mt-2 h-8 w-20 animate-pulse rounded-lg bg-slate-100" aria-label="Loading" />
			) : (
				<p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl" style={display}>
					{value}
				</p>
			)}
			{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
		</div>
	);
}

export function Panel({ title, description, actions, children, flush }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
	return (
		<section className="rounded-2xl border border-slate-200 bg-white">
			{(title || actions) && (
				<header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
					<div className="min-w-0">
						{title && <h2 className="font-semibold text-slate-900">{title}</h2>}
						{description && <p className="text-sm text-slate-500">{description}</p>}
					</div>
					{actions}
				</header>
			)}
			<div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
		</section>
	);
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text?: string; action?: React.ReactNode }) {
	return (
		<div className="flex flex-col items-center px-4 py-12 text-center">
			<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
				<Icon className="h-6 w-6" aria-hidden />
			</span>
			<p className="mt-4 font-semibold text-slate-900">{title}</p>
			{text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

export function ErrorState({ text = "We couldn't load this. Check your connection and try again.", onRetry }: { text?: string; onRetry?: () => void }) {
	return (
		<div role="alert" className="flex flex-col items-center px-4 py-10 text-center">
			<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
				<AlertTriangle className="h-6 w-6" aria-hidden />
			</span>
			<p className="mt-4 max-w-sm text-sm text-slate-600">{text}</p>
			{onRetry && (
				<button
					type="button"
					onClick={onRetry}
					className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
				>
					<RotateCw className="h-4 w-4" aria-hidden /> Try again
				</button>
			)}
		</div>
	);
}

/** Placeholder rows shown while a list loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<ul className="divide-y divide-slate-100" aria-label="Loading">
			{Array.from({ length: rows }, (_, i) => (
				<li key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
					<div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
					<div className="flex-1 space-y-2">
						<div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
						<div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
					</div>
					<div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
				</li>
			))}
		</ul>
	);
}

/** Previous / next under a list: "Page 2 of 7 · 134 routes". Hidden when everything fits on one page. */
export function Pager({
	page,
	pages,
	total,
	noun,
	onPage,
	disabled,
}: {
	page: number;
	pages: number;
	total: number;
	noun: string;
	onPage: (page: number) => void;
	disabled?: boolean;
}) {
	if (pages <= 1) return null;
	const button = "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40";
	return (
		<nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
			<p className="text-sm text-slate-600">
				Page {page} of {pages} · {total.toLocaleString()} {noun}
			</p>
			<div className="flex gap-2">
				<button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1 || disabled} aria-label="Previous page" className={button}>
					<ChevronLeft className="h-4 w-4" aria-hidden />
				</button>
				<button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages || disabled} aria-label="Next page" className={button}>
					<ChevronRight className="h-4 w-4" aria-hidden />
				</button>
			</div>
		</nav>
	);
}
