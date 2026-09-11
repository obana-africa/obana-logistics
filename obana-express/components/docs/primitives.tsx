import React from "react";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";

// Building blocks for the developer docs. No hooks, so they render on the server.

/** Inline code that wraps instead of pushing the page wider on phones. */
export function C({ children }: { children: React.ReactNode }) {
	return <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-ink [overflow-wrap:anywhere]">{children}</code>;
}

export function P({ children }: { children: React.ReactNode }) {
	return <p className="mt-4 text-[15px] leading-7 text-slate-700">{children}</p>;
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
	return (
		<h3 id={id} className="mt-8 text-lg font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
			{children}
		</h3>
	);
}

/** One docs section: prose on the left, code panels on the right (stacked below on smaller screens). */
export function Section({ id, eyebrow, title, children, aside }: { id: string; eyebrow?: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
	return (
		<section id={id} className="scroll-mt-36! border-t border-line py-12 sm:py-14 lg:scroll-mt-24!">
			<div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-10">
				<div className="min-w-0">
					{eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-amber">{eyebrow}</p>}
					<h2 className="mt-1 text-2xl font-bold text-ink sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
						{title}
					</h2>
					{children}
				</div>
				{aside && (
					<div className="mt-8 min-w-0 xl:mt-0">
						<div className="space-y-4 xl:sticky xl:top-24">{aside}</div>
					</div>
				)}
			</div>
		</section>
	);
}

/** Method + path, and whether the call needs a store key. */
export function Endpoint({ method, path, auth }: { method: "GET" | "POST"; path: string; auth: "store" | "none" }) {
	return (
		<div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5">
			<span className={method === "GET" ? "rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800" : "rounded-md bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold text-sky-800"}>{method}</span>
			<code className="min-w-0 flex-1 font-mono text-sm font-semibold text-ink [overflow-wrap:anywhere]">{path}</code>
			<span className={auth === "store" ? "rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy" : "rounded-full bg-mint px-2.5 py-0.5 text-xs font-medium text-teal-800"}>
				{auth === "store" ? "Store key" : "No key needed"}
			</span>
		</div>
	);
}

export type Param = {
	name: string;
	type: string;
	level?: "required" | "recommended" | "optional";
	children?: React.ReactNode;
	fields?: Param[];
};

function ParamRow({ param }: { param: Param }) {
	return (
		<li className="py-3.5">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				<code className="font-mono text-sm font-semibold text-ink [overflow-wrap:anywhere]">{param.name}</code>
				<span className="text-xs text-muted">{param.type}</span>
				{param.level === "required" && <span className="text-xs font-semibold text-rose-600">Required</span>}
				{param.level === "recommended" && <span className="text-xs font-semibold text-amber-700">Recommended</span>}
			</div>
			{param.children && <div className="mt-1 text-sm leading-6 text-slate-600">{param.children}</div>}
			{param.fields && (
				<ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-canvas/60 px-3.5">
					{param.fields.map((field) => (
						<ParamRow key={field.name} param={field} />
					))}
				</ul>
			)}
		</li>
	);
}

/** Parameter / field list — reads well on a phone, unlike a wide table. */
export function Params({ title, params }: { title: string; params: Param[] }) {
	return (
		<div className="mt-7">
			<h4 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h4>
			<ul className="mt-2 divide-y divide-line border-y border-line">
				{params.map((param) => (
					<ParamRow key={param.name} param={param} />
				))}
			</ul>
		</div>
	);
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "tip"; title?: string; children: React.ReactNode }) {
	const styles = {
		info: "border-sky-200 bg-sky-50 text-sky-950",
		warn: "border-amber-200 bg-amber-50 text-amber-950",
		tip: "border-emerald-200 bg-emerald-50 text-emerald-950",
	};
	const icons = {
		info: <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />,
		warn: <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />,
		tip: <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />,
	};
	return (
		<div className={`mt-5 flex gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6 ${styles[tone]}`}>
			{icons[tone]}
			<div className="min-w-0">
				{title && <p className="font-semibold">{title}</p>}
				<div>{children}</div>
			</div>
		</div>
	);
}

/** Two-column list of terms (status codes, statuses, headers). */
export function DefList({ rows }: { rows: { term: React.ReactNode; children: React.ReactNode }[] }) {
	return (
		<dl className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
			{rows.map((row, i) => (
				<div key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-4">
					<dt className="min-w-0 text-sm font-semibold text-ink">{row.term}</dt>
					<dd className="min-w-0 text-sm leading-6 text-slate-600">{row.children}</dd>
				</div>
			))}
		</dl>
	);
}

/** Numbered steps for task-first guides. */
export function Steps({ steps }: { steps: { title: string; children: React.ReactNode }[] }) {
	return (
		<ol className="mt-6 space-y-5">
			{steps.map((step, i) => (
				<li key={step.title} className="flex gap-4">
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
					<div className="min-w-0 pt-0.5">
						<p className="font-semibold text-ink">{step.title}</p>
						<div className="mt-1 text-sm leading-6 text-slate-600">{step.children}</div>
					</div>
				</li>
			))}
		</ol>
	);
}
