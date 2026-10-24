"use client";

import { Check, Plane } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/api";

/**
 * The air waybill number, typed straight onto the shipment.
 *
 * It used to be read only from the note beside an attached file, so somebody
 * who had the number but not yet the paperwork — which is the normal order —
 * typed it, attached nothing, and lost it. The summary then went out without
 * a waybill on it.
 *
 * Saving reissues the summary, because that is the document the number is
 * wanted on.
 */
export function AwbNumber({
	shipmentId,
	initial,
	canEdit = true,
}: {
	shipmentId: string | number;
	initial?: string | null;
	canEdit?: boolean;
}) {
	const [value, setValue] = useState(initial ?? "");
	const [saved, setSaved] = useState(initial ?? "");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);

	const save = async () => {
		setBusy(true);
		setError("");
		setDone(false);
		try {
			await apiClient.setShipmentAwb(shipmentId, value.trim());
			setSaved(value.trim());
			setDone(true);
		} catch (err) {
			const e = err as { response?: { data?: { message?: string } } };
			setError(e?.response?.data?.message ?? "That did not save. Please try again.");
		} finally {
			setBusy(false);
		}
	};

	if (!canEdit) {
		return saved ? (
			<p className="text-sm text-slate-700">
				<span className="text-slate-500">Air waybill:</span> <span className="font-medium">{saved}</span>
			</p>
		) : null;
	}

	return (
		<section className="rounded-xl border bg-white p-4 sm:p-5">
			<h2 className="mb-1 flex items-center gap-2 font-semibold text-base">
				<Plane className="h-4 w-4 text-slate-400" aria-hidden />
				Air waybill
			</h2>
			<p className="mb-4 text-muted-foreground text-sm">
				The number, as soon as the forwarder issues it. It goes on the shipment summary — the
				paperwork can follow later.
			</p>

			<div className="flex flex-wrap items-end gap-2">
				<label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs">
					<span className="font-medium">Waybill number</span>
					<input
						id="awb-number"
						value={value}
						onChange={(e) => {
							setValue(e.target.value);
							setDone(false);
						}}
						placeholder="e.g. 123-45678901"
						disabled={busy}
						className="h-9 rounded-md border px-2 text-sm"
					/>
				</label>
				<button
					type="button"
					onClick={save}
					disabled={busy || value.trim() === saved.trim()}
					className="h-9 rounded-md bg-slate-900 px-4 font-medium text-sm text-white disabled:opacity-50"
				>
					{busy ? "Saving…" : "Save"}
				</button>
			</div>

			{done && !error && (
				<p className="mt-2 flex items-center gap-1.5 text-emerald-700 text-sm">
					<Check className="h-4 w-4" aria-hidden />
					{saved ? "Saved — the summary has been reissued." : "Cleared."}
				</p>
			)}
			{error && <p className="mt-2 text-rose-600 text-sm">{error}</p>}
		</section>
	);
}

export default AwbNumber;
