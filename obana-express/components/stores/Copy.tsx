"use client";

import React, { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copy to clipboard; `state` flips to "copied" (or "failed" when the browser blocks it) for 2 seconds. */
export function useCopy() {
	const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const copy = async (text: string) => {
		let ok = false;
		try {
			await navigator.clipboard.writeText(text);
			ok = true;
		} catch {
			ok = false;
		}
		setState(ok ? "copied" : "failed");
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setState("idle"), 2000);
		return ok;
	};
	return { state, copy };
}

export function CopyButton({
	text,
	label = "Copy",
	copiedLabel = "Copied",
	dark = false,
	className = "",
}: {
	text: string;
	label?: string;
	copiedLabel?: string;
	dark?: boolean;
	className?: string;
}) {
	const { state, copy } = useCopy();
	return (
		<button
			type="button"
			onClick={() => copy(text)}
			className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 ${
				dark ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/20" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-[#1B3B5F]/20"
			} ${className}`}
		>
			{state === "copied" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
			<span aria-live="polite">{state === "copied" ? copiedLabel : state === "failed" ? "Select & copy" : label}</span>
		</button>
	);
}

/**
 * Dark code box. Long lines scroll inside the box, never the page.
 * `w-0 min-w-full` stops the unbreakable line from widening grid/flex parents (e.g. AuthShell's grid) while still filling the width.
 */
export function CodeBox({ code, label, copyLabel = "Copy" }: { code: string; label?: string; copyLabel?: string }) {
	return (
		<div className="w-0 min-w-full overflow-hidden rounded-2xl bg-slate-900">
			<div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
				<p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label ?? "Terminal"}</p>
				<CopyButton text={code} label={copyLabel} dark />
			</div>
			<pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100">
				<code>{code}</code>
			</pre>
		</div>
	);
}
