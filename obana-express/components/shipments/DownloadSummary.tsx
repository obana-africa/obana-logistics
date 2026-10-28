"use client";

/**
 * Download this shipment's summary.
 *
 * The PDF is built by the API, not here: it is the same document that was
 * attached to the shipment at booking and the same one a WhatsApp link opens,
 * so what an admin forwards to a customer and what the customer already has
 * cannot say different things.
 *
 * The file arrives as a Blob because the route is authenticated — a plain link
 * carries no token — so it is handed to the browser through an object URL that
 * is revoked as soon as the download starts.
 */

import React, { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { errorMessage } from "@/lib/useRemote";

export function DownloadSummary({
	shipmentId,
	reference,
	variant = "secondary",
	size,
	onError,
}: {
	/** Id or reference — the API takes either. */
	shipmentId: string | number;
	/** Names the saved file, so a folder of these is readable. */
	reference: string;
	variant?: "primary" | "secondary" | "ghost";
	size?: "sm" | "md" | "lg";
	onError?: (message: string) => void;
}) {
	const [busy, setBusy] = useState(false);

	const download = async () => {
		setBusy(true);
		try {
			const blob = await apiClient.downloadShipmentSummary(shipmentId);
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `Shipment summary ${reference}.pdf`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			/* Asking for a Blob means the API's own error body arrives as one
			   too, so "not found" and "not yours to see" would otherwise come
			   back as "Request failed with status code 404". Read it back. */
			const body = (err as { response?: { data?: unknown } })?.response?.data;
			let said = "";
			if (body instanceof Blob) {
				try {
					said = JSON.parse(await body.text())?.message ?? "";
				} catch {
					said = "";
				}
			}
			onError?.(said || errorMessage(err, "The summary could not be downloaded. Try again in a moment."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Button variant={variant} size={size} loading={busy} onClick={download}>
			<Download className="h-4 w-4" aria-hidden /> Download summary
		</Button>
	);
}
