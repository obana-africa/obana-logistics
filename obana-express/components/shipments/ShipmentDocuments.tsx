"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";

/**
 * The papers a shipment is about, on the shipment.
 *
 * Air waybills, commercial invoices, a photograph of the goods on the pallet.
 * These were being passed around on WhatsApp, which means the number everybody
 * needs sits in a thread one person can see and the shipment record says
 * nothing about it. Anyone who can open the shipment can now read them; the
 * people who handle it can add them.
 *
 * Uploads go to Cloudinary through the API, which holds the credentials — the
 * browser never gets them. A PDF stays a PDF.
 */

export type ShipmentDocument = {
	id: string;
	url: string;
	name: string;
	kind?: string | null;
	note?: string | null;
	uploadedAt?: string;
	uploadedBy?: string;
};

/* The ones people actually attach. Free text underneath, because the next
   kind nobody has thought of should not need a deploy. */
const KINDS = ["AWB", "Invoice", "Packing list", "Photo", "Customs", "Other"];

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "application/pdf,image/*";

const when = (iso?: string) => {
	if (!iso) return "";
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** A data URL, which is what the API takes. */
const asDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error("That file could not be read"));
		reader.readAsDataURL(file);
	});

export function ShipmentDocuments({
	shipmentId,
	initial,
	canEdit = true,
}: {
	shipmentId: string | number;
	/** What the shipment already came with, so the panel fills without a second call. */
	initial?: ShipmentDocument[];
	canEdit?: boolean;
}) {
	const [docs, setDocs] = useState<ShipmentDocument[]>(initial ?? []);
	const [loading, setLoading] = useState(!initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kind, setKind] = useState(KINDS[0]);
	const [note, setNote] = useState("");
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (initial) return;
		let cancelled = false;
		apiClient
			.listShipmentDocuments(shipmentId)
			.then((res: any) => {
				if (!cancelled) setDocs(Array.isArray(res?.data) ? res.data : []);
			})
			.catch(() => {
				/* A shipment must still read when its documents will not. */
				if (!cancelled) setDocs([]);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [shipmentId, initial]);

	const attach = async (file: File | undefined) => {
		if (!file) return;
		if (file.size > MAX_BYTES) {
			setError("That file is over 15 MB. Send a smaller copy.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const res: any = await apiClient.addShipmentDocument(shipmentId, {
				file: await asDataUrl(file),
				name: file.name,
				kind,
				note: note.trim() || undefined,
			});
			setDocs(Array.isArray(res?.documents) ? res.documents : [...docs, res.data]);
			setNote("");
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? "That did not attach. Please try again.");
		} finally {
			setBusy(false);
		}
	};

	const remove = async (id: string) => {
		setBusy(true);
		setError(null);
		try {
			const res: any = await apiClient.removeShipmentDocument(shipmentId, id);
			setDocs(Array.isArray(res?.data) ? res.data : docs.filter((d) => d.id !== id));
		} catch (err: any) {
			setError(err?.response?.data?.message ?? "That did not come off. Please try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="rounded-xl border bg-white p-4 sm:p-5">
			<div className="mb-1 flex items-baseline justify-between gap-3">
				<h2 className="font-semibold text-base">Documents</h2>
				{docs.length > 0 && (
					<span className="text-muted-foreground text-xs">
						{docs.length} attached
					</span>
				)}
			</div>
			<p className="mb-4 text-muted-foreground text-sm">
				Waybills, invoices and photographs of the goods. Everyone who can see this
				shipment can open them.
			</p>

			{loading ? (
				<p className="text-muted-foreground text-sm">Loading…</p>
			) : docs.length === 0 ? (
				<p className="rounded-lg bg-muted/40 px-3 py-6 text-center text-muted-foreground text-sm">
					Nothing attached yet.
				</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{docs.map((d) => (
						<li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
							<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium text-[11px] uppercase tracking-wide">
								{d.kind || "Doc"}
							</span>
							<div className="min-w-0 flex-1">
								<a
									href={d.url}
									target="_blank"
									rel="noopener noreferrer"
									className="block truncate font-medium text-sm hover:underline"
								>
									{d.name}
								</a>
								{(d.note || d.uploadedAt) && (
									<p className="truncate text-muted-foreground text-xs">
										{[d.note, when(d.uploadedAt)].filter(Boolean).join(" · ")}
									</p>
								)}
							</div>
							{canEdit && (
								<button
									type="button"
									onClick={() => remove(d.id)}
									disabled={busy}
									className="shrink-0 text-rose-600 text-xs hover:underline disabled:opacity-50"
								>
									Remove
								</button>
							)}
						</li>
					))}
				</ul>
			)}

			{canEdit && (
				<div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
					<label className="flex flex-col gap-1 text-xs">
						<span className="font-medium">Kind</span>
						<select
							value={kind}
							onChange={(e) => setKind(e.target.value)}
							disabled={busy}
							className="h-9 rounded-md border px-2 text-sm"
						>
							{KINDS.map((k) => (
								<option key={k} value={k}>
									{k}
								</option>
							))}
						</select>
					</label>
					<label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs">
						<span className="font-medium">Note (optional)</span>
						<input
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="e.g. AWB 123-45678901, RwandAir, arrives Tue"
							disabled={busy}
							className="h-9 rounded-md border px-2 text-sm"
						/>
					</label>
					<input
						ref={input}
						type="file"
						accept={ACCEPT}
						hidden
						onChange={(e) => {
							attach(e.target.files?.[0]);
							e.target.value = "";
						}}
					/>
					<button
						type="button"
						onClick={() => input.current?.click()}
						disabled={busy}
						className="h-9 rounded-md bg-slate-900 px-4 font-medium text-sm text-white disabled:opacity-60"
					>
						{busy ? "Attaching…" : "Attach a file"}
					</button>
				</div>
			)}

			{error && <p className="mt-2 text-rose-600 text-sm">{error}</p>}
		</section>
	);
}

export default ShipmentDocuments;
