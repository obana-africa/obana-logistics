"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import {
	DOCUMENT_ACCEPT,
	DOCUMENT_KINDS,
	type ShipmentDocument,
	asDataUrl,
	documentDate,
	canPreview,
	documentLink,
	overSize,
	thumbUrl,
	uploadFailureReason,
} from "@/lib/shipmentDocuments";
import { DocumentViewer } from "./DocumentViewer";

/**
 * The papers a shipment is about, on the shipment.
 *
 * Air waybills, commercial invoices, a photograph of the goods on the pallet.
 * These were being passed around on WhatsApp, which means the number everybody
 * needs sits in a thread one person can see and the shipment record says
 * nothing about it. Anyone who is part of the shipment can now read them and
 * add to them — the sender included, since the invoice and the packing list
 * usually come from them.
 *
 * Uploads go to Cloudinary through the API, which holds the credentials — the
 * browser never gets them. A PDF stays a PDF.
 */

export type { ShipmentDocument };

/* What the document endpoints answer with, and what a failed call carries —
   named so the handlers below do not have to say `any` and lose it. */
type DocumentsReply = { data?: unknown; documents?: unknown };
type RequestFailure = { response?: { data?: { message?: string } }; message?: string };
const messageFrom = (err: unknown, fallback: string) => {
	const e = err as RequestFailure;
	return e?.response?.data?.message ?? e?.message ?? fallback;
};
const asDocs = (value: unknown) => (Array.isArray(value) ? (value as ShipmentDocument[]) : null);

export function ShipmentDocuments({
	shipmentId,
	reference,
	initial,
	canEdit = true,
}: {
	shipmentId: string | number;
	/* The shipment's reference. Document links are keyed on it, because the
	   route that signs them is the public one a customer uses too. */
	reference?: string | null;
	/** What the shipment already came with, so the panel fills without a second call. */
	initial?: ShipmentDocument[];
	canEdit?: boolean;
}) {
	const [docs, setDocs] = useState<ShipmentDocument[]>(initial ?? []);
	const [loading, setLoading] = useState(!initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kind, setKind] = useState(DOCUMENT_KINDS[0]);
	const [note, setNote] = useState("");
	/* The one open over the page, if any. */
	const [viewing, setViewing] = useState<ShipmentDocument | null>(null);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (initial) return;
		let cancelled = false;
		apiClient
			.listShipmentDocuments(shipmentId)
			.then((res: DocumentsReply) => {
				if (!cancelled) setDocs(asDocs(res?.data) ?? []);
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
		if (overSize(file)) {
			setError("That file is over 15 MB. Send a smaller copy.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const res: DocumentsReply = await apiClient.addShipmentDocument(shipmentId, {
				file: await asDataUrl(file),
				name: file.name,
				kind,
				note: note.trim() || undefined,
			});
			setDocs(asDocs(res?.documents) ?? [...docs, res.data as ShipmentDocument]);
			setNote("");
		} catch (err) {
			setError(`That did not attach: ${uploadFailureReason(err)}.`);
		} finally {
			setBusy(false);
		}
	};

	const remove = async (id: string) => {
		setBusy(true);
		setError(null);
		try {
			const res: DocumentsReply = await apiClient.removeShipmentDocument(shipmentId, id);
			setDocs(asDocs(res?.data) ?? docs.filter((d) => d.id !== id));
		} catch (err) {
			setError(messageFrom(err, "That did not come off. Please try again."));
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
					{docs.map((d) => {
						const shows = canPreview(d);
						return (
							<li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
								{/* A thumbnail says what a file is faster than its name does.
								    Clicking a picture opens it here; a PDF goes to its own
								    tab, which is where a browser reads one properly. */}
								{shows ? (
									<button
										type="button"
										onClick={() => setViewing(d)}
										className="shrink-0 overflow-hidden rounded-md border transition-opacity hover:opacity-80"
										aria-label={`View ${d.name}`}
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img src={thumbUrl(d.url)} alt="" className="h-12 w-12 object-cover" />
									</button>
								) : (
									<a
										href={documentLink(d, reference, { inline: true })}
										target="_blank"
										rel="noopener noreferrer"
										className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted/50 transition-colors hover:bg-muted"
										aria-label={`Open ${d.name}`}
									>
										<FileText className="h-5 w-5 text-slate-500" aria-hidden />
									</a>
								)}
								<div className="min-w-0 flex-1">
									<span className="inline-block rounded bg-muted px-1.5 py-0.5 font-medium text-[11px] uppercase tracking-wide">
										{d.kind || "Doc"}
									</span>
									{shows ? (
										<button
											type="button"
											onClick={() => setViewing(d)}
											className="block max-w-full truncate text-left font-medium text-sm hover:underline"
										>
											{d.name}
										</button>
									) : (
										<a
											href={documentLink(d, reference, { inline: true })}
											target="_blank"
											rel="noopener noreferrer"
											className="block truncate font-medium text-sm hover:underline"
										>
											{d.name}
										</a>
									)}
									{(d.note || d.uploadedAt) && (
										<p className="truncate text-muted-foreground text-xs">
											{[d.note, documentDate(d.uploadedAt)].filter(Boolean).join(" \u00b7 ")}
										</p>
									)}
								</div>
								<a
									href={documentLink(d, reference)}
									download={d.name}
									aria-label={`Download ${d.name}`}
									title="Download"
									className="shrink-0 rounded-md p-2 text-slate-400 transition-colors hover:bg-muted hover:text-slate-700"
								>
									<Download className="h-4 w-4" aria-hidden />
								</a>
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
						);
					})}
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
							{DOCUMENT_KINDS.map((k) => (
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
						accept={DOCUMENT_ACCEPT}
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

			{viewing && <DocumentViewer doc={viewing} reference={reference} onClose={() => setViewing(null)} />}
		</section>
	);
}

export default ShipmentDocuments;
