"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ShipmentDocument } from "@/lib/shipmentDocuments";

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
			{/* Clicks on the picture itself keep it open; the backdrop closes it. */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={doc.url}
				alt={doc.name}
				onClick={(e) => e.stopPropagation()}
				className="min-h-0 flex-1 cursor-default rounded-lg bg-white/5 object-contain"
			/>
		</div>
	);
}

export default DocumentViewer;
