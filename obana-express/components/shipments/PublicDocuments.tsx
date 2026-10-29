"use client";

import { Download, FileText, Paperclip } from "lucide-react";
import { useState } from "react";
import {
	type ShipmentDocument,
	canPreview,
	documentDate,
	documentLink,
	thumbUrl,
} from "@/lib/shipmentDocuments";
import { DocumentViewer } from "./DocumentViewer";

/**
 * The papers on a shipment, for somebody who is not signed in.
 *
 * A customer who attaches a receipt reads the notification about it on a phone,
 * from WhatsApp, with no account and no session. The dashboard panel cannot
 * serve them: it fetches from an authenticated endpoint and offers to upload
 * and delete. This one is the other half — read only, fed by whatever the
 * public tracking lookup already returned, and it opens a picture where it
 * stands rather than sending anyone to a new tab.
 *
 * Renders nothing when there is nothing attached, so a shipment without papers
 * does not grow an empty heading.
 */
export function PublicDocuments({
	documents,
	reference,
	className = "",
}: {
	documents?: ShipmentDocument[] | null;
	/* The shipment these hang off. Document links are keyed on it. */
	reference?: string | null;
	className?: string;
}) {
	const [viewing, setViewing] = useState<ShipmentDocument | null>(null);
	const docs = (documents ?? []).filter((d) => d?.url);

	if (docs.length === 0) return null;

	return (
		<div className={className}>
			<h3 className="mb-2 flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
				<Paperclip className="h-4 w-4 text-slate-400" aria-hidden />
				Documents
				<span className="font-normal text-slate-400">({docs.length})</span>
			</h3>
			<ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
				{docs.map((d) => {
					const shows = canPreview(d);
					return (
						<li key={d.id || d.url} className="flex items-center gap-3 bg-white px-3 py-2.5">
							{shows ? (
								<button
									type="button"
									onClick={() => setViewing(d)}
									className="shrink-0 overflow-hidden rounded-md border border-slate-200 transition-opacity hover:opacity-80"
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
									className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100"
									aria-label={`Open ${d.name}`}
								>
									<FileText className="h-5 w-5 text-slate-500" aria-hidden />
								</a>
							)}
							<div className="min-w-0 flex-1">
								{d.kind && (
									<span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-medium text-[11px] text-slate-600 uppercase tracking-wide">
										{d.kind}
									</span>
								)}
								{shows ? (
									<button
										type="button"
										onClick={() => setViewing(d)}
										className="block max-w-full truncate text-left font-medium text-slate-900 text-sm hover:underline"
									>
										{d.name}
									</button>
								) : (
									<a
										href={documentLink(d, reference, { inline: true })}
										target="_blank"
										rel="noopener noreferrer"
										className="block truncate font-medium text-slate-900 text-sm hover:underline"
									>
										{d.name}
									</a>
								)}
								{(d.note || d.uploadedAt) && (
									<p className="truncate text-slate-500 text-xs">
										{[d.note, documentDate(d.uploadedAt)].filter(Boolean).join(" · ")}
									</p>
								)}
							</div>
							{/* Saved, not opened — fl_attachment, because the download
							    attribute does nothing across origins. */}
							<a
								href={documentLink(d, reference)}
								download={d.name}
								onClick={(e) => e.stopPropagation()}
								aria-label={`Download ${d.name}`}
								title="Download"
								className="shrink-0 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
							>
								<Download className="h-4 w-4" aria-hidden />
							</a>
						</li>
					);
				})}
			</ul>

			{viewing && <DocumentViewer doc={viewing} reference={reference} onClose={() => setViewing(null)} />}
		</div>
	);
}

export default PublicDocuments;
