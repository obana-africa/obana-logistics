"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	DOCUMENT_ACCEPT,
	DOCUMENT_KINDS,
	type PendingDocument,
	fileSize,
	isImage,
	overSize,
} from "@/lib/shipmentDocuments";

/**
 * Papers chosen while booking, before the shipment exists.
 *
 * The shipment page can upload straight away because it has an id to attach
 * to. Here there is nothing to attach to yet, so the files wait in the browser
 * and go up the moment the shipment is created. Nobody has to come back for a
 * second pass with the invoice they already had in their hand.
 *
 * Nothing leaves the browser until then — a preview of a picture is read from
 * the file itself, not from a server.
 */

/** A thumbnail of a local file, released when it is no longer shown. */
function LocalThumb({ file }: { file: File }) {
	const src = useMemo(() => URL.createObjectURL(file), [file]);
	/* An object URL holds the file in memory until it is revoked. */
	useEffect(() => () => URL.revokeObjectURL(src), [src]);

	/* eslint-disable-next-line @next/next/no-img-element */
	return <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-md border object-cover" />;
}

export function DocumentPicker({
	value,
	onChange,
	onAwbTyped,
	disabled = false,
}: {
	value: PendingDocument[];
	onChange: (next: PendingDocument[]) => void;
	/**
	 * The waybill number as it is typed, before any file is chosen.
	 *
	 * The note only travels attached to a file, so somebody who had the number
	 * but not yet the paperwork typed it, picked nothing, and lost it. The
	 * number usually arrives first, so it is reported as it is typed and goes
	 * with the booking on its own.
	 */
	onAwbTyped?: (awb: string) => void;
	disabled?: boolean;
}) {
	const [kind, setKind] = useState(DOCUMENT_KINDS[0]);
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const input = useRef<HTMLInputElement>(null);

	const add = (files: FileList | null) => {
		if (!files?.length) return;
		const tooBig = Array.from(files).filter(overSize);
		if (tooBig.length) {
			setError(`${tooBig.map((f) => f.name).join(", ")} — over 15 MB. Attach a smaller copy.`);
		} else {
			setError("");
		}
		const keep = Array.from(files)
			.filter((f) => !overSize(f))
			.map((file) => ({ file, kind, note: note.trim() }));
		if (keep.length) {
			onChange([...value, ...keep]);
			/* The note is cleared for the next file; the waybill number it held
			   stays reported, because it belongs to the shipment rather than to
			   the file that happened to carry it. */
			setNote("");
		}
	};

	return (
		<div className="rounded-xl border-2 border-slate-200 bg-linear-to-br from-slate-50 to-white p-6">
			<h3 className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
				<Paperclip className="h-5 w-5 text-slate-500" />
				Documents <span className="font-normal text-gray-500 text-sm">(optional)</span>
			</h3>
			<p className="mb-5 text-gray-600 text-sm">
				The waybill, a commercial invoice, a photograph of the goods on the pallet. They go on the
				shipment as soon as it is created, and everyone handling it can see them.
			</p>

			{value.length > 0 && (
				<ul className="mb-4 space-y-2">
					{value.map((d, i) => (
						<li
							key={`${d.file.name}-${i}`}
							className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
						>
							{isImage({ name: d.file.name }) ? (
								<LocalThumb file={d.file} />
							) : (
								<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-slate-50">
									<FileText className="h-5 w-5 text-slate-500" aria-hidden />
								</span>
							)}
							<div className="min-w-0 flex-1">
								<span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-medium text-[11px] text-slate-600 uppercase tracking-wide">
									{d.kind}
								</span>
								<p className="truncate font-medium text-gray-900 text-sm">{d.file.name}</p>
								<p className="truncate text-gray-500 text-xs">
									{[d.note, fileSize(d.file.size)].filter(Boolean).join(" · ")}
								</p>
							</div>
							<button
								type="button"
								onClick={() => onChange(value.filter((_, j) => j !== i))}
								disabled={disabled}
								aria-label={`Remove ${d.file.name}`}
								className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
							>
								<X className="h-4 w-4" />
							</button>
						</li>
					))}
				</ul>
			)}

			<div className="flex flex-wrap items-end gap-2">
				<label className="flex flex-col gap-1 text-xs">
					<span className="font-medium text-gray-700">Kind</span>
					<select
						id="document-kind"
						value={kind}
						onChange={(e) => {
							setKind(e.target.value);
							onAwbTyped?.(e.target.value.toUpperCase() === "AWB" ? note.trim() : "");
						}}
						disabled={disabled}
						className="h-10 rounded-lg border-2 border-slate-200 px-2 text-sm"
					>
						{DOCUMENT_KINDS.map((k) => (
							<option key={k} value={k}>
								{k}
							</option>
						))}
					</select>
				</label>
				<label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs">
					<span className="font-medium text-gray-700">Note (optional)</span>
					<input
						id="document-note"
						value={note}
						onChange={(e) => {
							setNote(e.target.value);
							/* Only when it is a waybill: a note on an invoice is a
							   note, not a number anything else should read. */
							if (kind.toUpperCase() === "AWB") onAwbTyped?.(e.target.value.trim());
						}}
						placeholder="e.g. AWB 123-45678901, RwandAir"
						disabled={disabled}
						className="h-10 rounded-lg border-2 border-slate-200 px-3 text-sm"
					/>
				</label>
				<input
					ref={input}
					id="document-file"
					type="file"
					accept={DOCUMENT_ACCEPT}
					multiple
					hidden
					onChange={(e) => {
						add(e.target.files);
						e.target.value = "";
					}}
				/>
				<button
					type="button"
					onClick={() => input.current?.click()}
					disabled={disabled}
					className="h-10 rounded-lg border-2 border-slate-300 px-4 font-semibold text-slate-700 text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
				>
					Choose files
				</button>
			</div>

			{error && <p className="mt-2 text-rose-600 text-sm">{error}</p>}
		</div>
	);
}

export default DocumentPicker;
