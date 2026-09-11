"use client";

import React, { useRef } from "react";

type TabItem<T extends string> = { value: T; label: string };

/** Accessible tab list (arrow keys, Home/End). Scrolls sideways on phones instead of wrapping. */
export function TabList<T extends string>({ tabs, value, onChange, label, idBase }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string; idBase: string }) {
	const refs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

	const onKeyDown = (e: React.KeyboardEvent, index: number) => {
		let next = -1;
		if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
		else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
		else if (e.key === "Home") next = 0;
		else if (e.key === "End") next = tabs.length - 1;
		if (next < 0) return;
		e.preventDefault();
		onChange(tabs[next].value);
		refs.current[tabs[next].value]?.focus();
	};

	return (
		<div role="tablist" aria-label={label} className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
			{tabs.map((t, i) => {
				const active = t.value === value;
				return (
					<button
						key={t.value}
						ref={(el) => {
							refs.current[t.value] = el;
						}}
						type="button"
						role="tab"
						id={`${idBase}-tab-${t.value}`}
						aria-selected={active}
						aria-controls={`${idBase}-panel`}
						tabIndex={active ? 0 : -1}
						onClick={() => onChange(t.value)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className={`-mb-px h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20 ${
							active ? "border-[#1B3B5F] text-[#1B3B5F]" : "border-transparent text-slate-500 hover:text-slate-900"
						}`}
					>
						{t.label}
					</button>
				);
			})}
		</div>
	);
}
