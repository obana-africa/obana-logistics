"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type ShipmentDocument, downloadUrl, isPdf, previewUrl } from "@/lib/shipmentDocuments";

/**
 * A photograph, opened where it was listed.
 *
 * A waybill or a picture of the goods on the pallet is looked at, not
 * downloaded: sending somebody to a new tab to see whether this is the right
 * invoice loses the shipment they were reading. So an image opens over the
 * page and closes again. A PDF still opens in its own tab, because that is
 * where a browser reads one properly.
 */
export function DocumentViewer({ doc, onClose }: { doc: ShipmentDocument; onClose: () => void }) {
	/* Set when the picture itself will not load — a file type the account does
	   not serve, a link that has expired. Better to say so and offer the file
	   than leave a broken-image mark on a black screen. */
	const [failed, setFailed] = useState(false);
	const pdf = isPdf(doc);
	/* Escape closes it, and the page underneath does not scroll while it is
	   open — both are what anyone who has used one of these expects. */
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
		};
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-[60] flex flex-col bg-black/85 p-4 backdrop-blur-sm sm:p-6"
			role="dialog"
			aria-modal="true"
			aria-label={doc.name}
			onClick={onClose}
		>
			<div className="mb-3 flex items-start justify-between gap-4 text-white">
				<div className="min-w-0">
					<p className="truncate font-medium text-sm">{doc.name}</p>
					{(doc.kind || doc.note) && (
						<p className="truncate text-white/70 text-xs">{[doc.kind, doc.note].filter(Boolean).join(" · ")}</p>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{/* Saved rather than opened: the download attribute is ignored
					    across origins, so the link carries fl_attachment instead. */}
					<a
						href={downloadUrl(doc.url)}
						download={doc.name}
						onClick={(e) => e.stopPropagation()}
						className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 font-medium text-xs transition-colors hover:bg-white/10"
					>
						<Download className="h-3.5 w-3.5" aria-hidden />
						Download
					</a>
					{/* The full file, for printing or sending on. */}
					<a
						href={doc.url}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						className="rounded-lg border border-white/30 px-3 py-1.5 font-medium text-xs transition-colors hover:bg-white/10"
					>
						Open original
					</a>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
			</div>
			{/* Clicks on the picture itself keep it open; the backdrop closes it.
			    A PDF is drawn by Cloudinary as its first page — what somebody
			    checking "is this the right waybill?" wants, and it arrives in a
			    moment rather than as a download. */}
			{failed ? (
				<div
					onClick={(e) => e.stopPropagation()}
					className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-white/5 p-6 text-center"
				>
					<p className="text-sm text-white/80">This one cannot be shown here.</p>
					<a
						href={downloadUrl(doc.url)}
						download={doc.name}
						className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 font-semibold text-slate-900 text-sm"
					>
						<Download className="h-4 w-4" aria-hidden />
						Download it instead
					</a>
				</div>
			) : (
				<>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={previewUrl(doc.url)}
						alt={doc.name}
						onError={() => setFailed(true)}
						onClick={(e) => e.stopPropagation()}
						className="min-h-0 flex-1 cursor-default rounded-lg bg-white/5 object-contain"
					/>
					{pdf && (
						<p className="mt-2 shrink-0 text-center text-white/50 text-xs">
							First page. Download for the whole document.
						</p>
					)}
				</>
			)}
		</div>
	);
}

export default DocumentViewer;
