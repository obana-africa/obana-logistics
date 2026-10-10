"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Deleting is permanent, so it asks for a code to be typed first.
 *
 * The code is never printed on screen. Showing it would make this a button
 * with an extra step; withholding it means only someone who knows it can
 * delete, which is the point.
 */
const DELETE_CODE = process.env.NEXT_PUBLIC_DELETE_CODE || "1234";

export default function ConfirmDelete({
	what,
	detail,
	consequence,
	onCancel,
	onConfirm,
}: {
	/** What is being deleted, named as the admin would say it: "Jane Doe", "OBN-1042". */
	what: string;
	/** A second line identifying it — an email, a route, a date. */
	detail?: string;
	/** What else goes with it, when deleting one thing takes others. */
	consequence?: string;
	onCancel: () => void;
	onConfirm: () => Promise<void> | void;
}) {
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const matches = code.trim() === DELETE_CODE;

	const run = async () => {
		if (!matches || busy) return;
		setBusy(true);
		setError("");
		try {
			await onConfirm();
		} catch (err) {
			const e = err as { message?: string };
			setError(e?.message ?? "Could not delete that. Nothing has been removed.");
			setBusy(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/55 p-4"
			role="alertdialog"
			aria-modal="true"
			aria-label={`Delete ${what}`}
			onClick={busy ? undefined : onCancel}
		>
			<div
				className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-start gap-3 border-b border-slate-100 p-5">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
						<AlertTriangle size={19} aria-hidden />
					</span>
					<div className="min-w-0 flex-1">
						<h2 className="text-base font-bold text-slate-900">Delete {what}?</h2>
						{detail && <p className="mt-0.5 truncate text-sm text-slate-500">{detail}</p>}
					</div>
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						aria-label="Cancel"
						className="text-slate-400 disabled:opacity-50"
					>
						<X size={18} />
					</button>
				</div>

				<div className="p-5">
					<p className="text-sm leading-relaxed text-slate-600">
						This cannot be undone.{consequence ? ` ${consequence}` : ""}
					</p>

					<label className="mt-4 block">
						<span className="text-xs font-semibold text-slate-700">Enter the delete code</span>
						<input
							value={code}
							onChange={(e) => {
								setCode(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && run()}
							type="password"
							inputMode="numeric"
							autoComplete="off"
							autoFocus
							disabled={busy}
							className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tracking-widest outline-none focus:border-red-500"
						/>
					</label>

					{error && <p className="mt-3 text-sm text-red-600">{error}</p>}

					<div className="mt-5 flex gap-2">
						<button
							type="button"
							onClick={run}
							disabled={!matches || busy}
							className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
						>
							{busy ? "Deleting…" : `Delete ${what}`}
						</button>
						<button
							type="button"
							onClick={onCancel}
							disabled={busy}
							className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
