"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { LANGS, setLang, useLang, type Lang } from "@/components/docs/languageStore";

export type Samples = Partial<Record<Lang, string>>;

const isComment = (line: string) => /^\s*(\/\/|# )/.test(line);

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[]
	);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Older browsers / non-secure pages: fall back to a hidden textarea.
			const area = document.createElement("textarea");
			area.value = text;
			area.setAttribute("readonly", "");
			area.style.position = "fixed";
			area.style.opacity = "0";
			document.body.appendChild(area);
			area.select();
			document.execCommand("copy");
			area.remove();
		}
		setCopied(true);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(false), 1800);
	};

	return (
		<button
			type="button"
			onClick={copy}
			aria-label={copied ? "Copied" : "Copy code"}
			className={
				copied
					? "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300"
					: "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
			}
		>
			{copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
			<span>{copied ? "Copied" : "Copy"}</span>
		</button>
	);
}

function Code({ code }: { code: string }) {
	const lines = code.split("\n");
	return (
		// Long lines scroll inside the block; the page itself never scrolls sideways.
		<pre tabIndex={0} className="max-h-[36rem] overflow-auto px-4 py-4 text-[13px] leading-6 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber/60">
			<code className="font-mono">
				{lines.map((line, i) => (
					<React.Fragment key={i}>
						<span className={isComment(line) ? "text-slate-500" : undefined}>{line}</span>
						{i < lines.length - 1 ? "\n" : null}
					</React.Fragment>
				))}
			</code>
		</pre>
	);
}

/** Heading strip for a code panel: an HTTP method + path, or a plain label. */
function PanelTitle({ title }: { title: string }) {
	const [method, ...rest] = title.split(" ");
	const isHttp = method === "GET" || method === "POST";
	return (
		<span className="flex min-w-0 items-center gap-2 text-xs">
			{isHttp ? (
				<>
					<span className={method === "GET" ? "font-mono font-bold text-emerald-300" : "font-mono font-bold text-sky-300"}>{method}</span>
					<span className="truncate font-mono text-slate-300">{rest.join(" ")}</span>
				</>
			) : (
				<span className="truncate font-medium text-slate-300">{title}</span>
			)}
		</span>
	);
}

/** Code sample with cURL / Node.js / Python / PHP tabs. The chosen language applies to every block on the page. */
export function CodeTabs({ title, samples }: { title?: string; samples: Samples }) {
	const preferred = useLang();
	const available = LANGS.filter((l) => samples[l.id] !== undefined);
	const active = available.some((l) => l.id === preferred) ? preferred : available[0].id;
	const code = samples[active] ?? "";

	return (
		<div className="overflow-hidden rounded-xl bg-navy-950 shadow-card ring-1 ring-navy-900" data-code-tabs>
			{title && (
				<div className="border-b border-white/10 px-4 py-2.5">
					<PanelTitle title={title} />
				</div>
			)}
			<div className="flex items-center gap-2 border-b border-white/10 pr-2">
				<div role="tablist" aria-label="Code language" className="flex min-w-0 flex-1 overflow-x-auto px-1">
					{available.map((l) => (
						<button
							key={l.id}
							type="button"
							role="tab"
							aria-selected={l.id === active}
							onClick={() => setLang(l.id)}
							className={
								l.id === active
									? "shrink-0 border-b-2 border-amber px-3 py-2.5 text-xs font-semibold text-white"
									: "shrink-0 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
							}
						>
							{l.label}
						</button>
					))}
				</div>
				<CopyButton text={code} />
			</div>
			<Code code={code} />
		</div>
	);
}

/** A single code panel (JSON responses, headers, one-liners). */
export function CodeBlock({ title, code }: { title: string; code: string }) {
	return (
		<div className="overflow-hidden rounded-xl bg-navy-950 shadow-card ring-1 ring-navy-900">
			<div className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 pl-4 pr-2">
				<PanelTitle title={title} />
				<CopyButton text={code} />
			</div>
			<Code code={code} />
		</div>
	);
}
