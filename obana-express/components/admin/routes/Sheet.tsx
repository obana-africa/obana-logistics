"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Dialog shell. "large": full-height sheet on phones, centred wide dialog on sm+.
 * "small": bottom sheet on phones, centred narrow dialog on sm+.
 * The panel is a <form> so the footer's submit button works; the body scrolls, the footer stays put.
 */
export function Sheet({
	title,
	description,
	size = "large",
	onClose,
	onSubmit,
	footer,
	children,
}: {
	title: string;
	description?: React.ReactNode;
	size?: "large" | "small";
	onClose: () => void;
	onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
	footer: React.ReactNode;
	children: React.ReactNode;
}) {
	const titleId = useId();
	const panelRef = useRef<HTMLFormElement>(null);
	const closeRef = useRef(onClose);

	useEffect(() => {
		closeRef.current = onClose;
	});

	useEffect(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		panelRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			// Let an open city list close first.
			if (e.key !== "Escape" || (e.target as HTMLElement | null)?.getAttribute?.("aria-expanded") === "true") return;
			closeRef.current();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
		};
	}, []);

	const large = size === "large";

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
			<button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
			<form
				ref={panelRef}
				tabIndex={-1}
				noValidate
				onSubmit={onSubmit ?? ((e) => e.preventDefault())}
				className={
					large
						? "relative flex h-dvh w-full flex-col bg-white shadow-2xl outline-none sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-3xl"
						: "relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:max-w-md sm:rounded-3xl"
				}
			>
				<header
					className={
						large
							? "flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:pt-5"
							: "flex items-start justify-between gap-3 px-5 pt-5"
					}
				>
					<div className="min-w-0">
						<h2 id={titleId} className="text-lg font-semibold text-slate-900">
							{title}
						</h2>
						{description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800">
						<X className="h-5 w-5" aria-hidden />
					</button>
				</header>
				<div className={large ? "min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" : "min-h-0 flex-1 overflow-y-auto px-5 py-4"}>{children}</div>
				<footer
					className={
						large
							? "flex gap-3 border-t border-slate-100 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:justify-end sm:rounded-b-3xl sm:px-6 sm:pb-4"
							: "flex gap-3 px-5 pt-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:justify-end sm:pb-5"
					}
				>
					{footer}
				</footer>
			</form>
		</div>
	);
}
