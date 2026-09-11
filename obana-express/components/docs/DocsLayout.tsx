"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TOC, TOC_ITEMS } from "@/components/docs/toc";

// Docs frame: sticky table of contents on desktop, a collapsible "On this page" bar on phones.

function TocLinks({ active, onPick }: { active: string; onPick: (id: string) => void }) {
	return (
		<>
			{TOC.map((group) => (
				<div key={group.group} className="mb-6 last:mb-0">
					<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{group.group}</p>
					<ul className="space-y-0.5 border-l border-line">
						{group.items.map((item) => (
							<li key={item.id}>
								<a
									href={`#${item.id}`}
									onClick={() => onPick(item.id)}
									aria-current={active === item.id ? "location" : undefined}
									className={
										active === item.id
											? "-ml-px block border-l-2 border-navy py-1.5 pl-4 text-sm font-semibold text-navy"
											: "-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-ink"
									}
								>
									{item.label}
								</a>
							</li>
						))}
					</ul>
				</div>
			))}
		</>
	);
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
	const [active, setActive] = useState(TOC_ITEMS[0].id);
	const [menuOpen, setMenuOpen] = useState(false);
	const visible = useRef(new Map<string, boolean>());

	// Highlight the section being read.
	useEffect(() => {
		const seen = visible.current;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
				const first = TOC_ITEMS.find((item) => seen.get(item.id));
				if (first) setActive(first.id);
			},
			// Top edge sits just below where anchor jumps land (144px on phones, 96px on desktop).
			{ rootMargin: "-160px 0px -55% 0px" }
		);
		for (const item of TOC_ITEMS) {
			const el = document.getElementById(item.id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, []);

	const activeLabel = TOC_ITEMS.find((item) => item.id === active)?.label ?? "";

	return (
		<div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
			{/* Phone / tablet: "On this page" menu under the site header */}
			<div className="sticky top-20 z-30 -mx-4 border-b border-line bg-white/95 backdrop-blur sm:-mx-6 lg:hidden">
				<button
					type="button"
					onClick={() => setMenuOpen((open) => !open)}
					aria-expanded={menuOpen}
					aria-controls="docs-mobile-toc"
					className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6"
				>
					<span className="min-w-0 truncate text-sm">
						<span className="text-muted">On this page</span>
						<span className="mx-1.5 text-slate-300" aria-hidden>
							/
						</span>
						<span className="font-semibold text-ink">{activeLabel}</span>
					</span>
					<ChevronDown className={menuOpen ? "h-4 w-4 shrink-0 rotate-180 text-muted transition-transform" : "h-4 w-4 shrink-0 text-muted transition-transform"} aria-hidden />
				</button>
				{menuOpen && (
					<nav id="docs-mobile-toc" aria-label="On this page" className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b border-line bg-white px-4 pb-5 pt-4 shadow-lift sm:px-6">
						<TocLinks
							active={active}
							onPick={(id) => {
								setActive(id);
								setMenuOpen(false);
							}}
						/>
					</nav>
				)}
			</div>

			<div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
				<aside className="hidden lg:block">
					<nav aria-label="Documentation sections" className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto pb-10 pr-2 pt-10">
						<TocLinks active={active} onPick={setActive} />
					</nav>
				</aside>
				<div className="min-w-0">{children}</div>
			</div>
		</div>
	);
}
