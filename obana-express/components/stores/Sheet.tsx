"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Alert, Button } from "@/components/ui";

/** Bottom sheet on phones, centred dialog from sm up. `dismissible={false}` keeps it open until an explicit action (e.g. a one-time key). */
export function Sheet({
	title,
	subtitle,
	onClose,
	dismissible = true,
	children,
}: {
	title: string;
	subtitle?: string;
	onClose: () => void;
	dismissible?: boolean;
	children: React.ReactNode;
}) {
	const titleId = useId();
	const panel = useRef<HTMLDivElement>(null);
	const closeRef = useRef(onClose);
	const dismissRef = useRef(dismissible);

	useEffect(() => {
		closeRef.current = onClose;
		dismissRef.current = dismissible;
	});

	// Focus the sheet, close it on Escape and stop the page scrolling behind it.
	useEffect(() => {
		panel.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && dismissRef.current) closeRef.current();
		};
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, []);

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
			<button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-slate-900/40" onClick={() => dismissible && onClose()} />
			<div
				ref={panel}
				tabIndex={-1}
				className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-3xl"
			>
				<div className="mb-4 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h2 id={titleId} className="text-lg font-semibold text-slate-900">
							{title}
						</h2>
						{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
					</div>
					{dismissible && (
						<button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
							<X className="h-5 w-5" />
						</button>
					)}
				</div>
				{children}
			</div>
		</div>
	);
}

/** In-app confirm (never window.confirm). */
export function ConfirmSheet({
	title,
	subtitle,
	children,
	confirmLabel,
	busyLabel = "Working…",
	danger = false,
	busy,
	error,
	onConfirm,
	onClose,
}: {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	confirmLabel: string;
	busyLabel?: string;
	danger?: boolean;
	busy: boolean;
	error?: string;
	onConfirm: () => void;
	onClose: () => void;
}) {
	return (
		<Sheet title={title} subtitle={subtitle} onClose={() => !busy && onClose()}>
			<div className="space-y-4">
				{error && <Alert type="error">{error}</Alert>}
				<div className="text-sm text-slate-600">{children}</div>
				<div className="grid gap-2 sm:grid-cols-2">
					<Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button variant={danger ? "danger" : "primary"} size="lg" fullWidth loading={busy} onClick={onConfirm}>
						{busy ? busyLabel : confirmLabel}
					</Button>
				</div>
			</div>
		</Sheet>
	);
}
