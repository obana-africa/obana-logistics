"use client";

import { ArrowRight, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { PublicDocuments } from "@/components/shipments/PublicDocuments";
import { apiClient } from "@/lib/api";
import type { ShipmentDocument } from "@/lib/shipmentDocuments";

/**
 * /documents/OBN-… — the papers on one shipment, for whoever has the reference.
 *
 * A customer attaches a receipt to a shipment and gets a WhatsApp message about
 * it. Tapping that message has to land somewhere that shows the receipt, on a
 * phone, with no account and no login — so this page takes nothing but the
 * reference, which is the only thing the message carries.
 *
 * Deliberately narrow: the reference, the status, and the files. Everything
 * else about the shipment is on the tracking view, and there is a link to it.
 */

type Shipment = {
	shipment_reference: string;
	display_status?: string;
	status?: string;
	documents?: ShipmentDocument[];
};

type State = { kind: "loading" } | { kind: "found"; shipment: Shipment } | { kind: "error"; message: string };

export default function ShipmentDocumentsPage({ params }: { params: Promise<{ reference: string }> }) {
	const { reference } = use(params);
	const [state, setState] = useState<State>({ kind: "loading" });
	/* The API sleeps when it is idle and takes the better part of a minute to
	   wake. A bare "Loading…" through that reads as a page that has hung, so
	   after five seconds it says what is happening instead. */
	const [slow, setSlow] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const slowTimer = setTimeout(() => {
			if (!cancelled) setSlow(true);
		}, 5000);
		const ref = decodeURIComponent(reference).trim();
		apiClient
			.getPublicShipment(ref)
			.then((res) => {
				if (cancelled) return;
				if (res.success && res.data) setState({ kind: "found", shipment: res.data as Shipment });
				else setState({ kind: "error", message: res.message || "We couldn't find that shipment." });
			})
			.catch((err) => {
				if (cancelled) return;
				const response = (err as { response?: { status?: number } })?.response;
				setState({
					kind: "error",
					message:
						response?.status === 404
							? "We couldn't find that shipment. Check the reference and try again."
							: "We can't reach Obana right now. Please try again in a moment.",
				});
			});
		return () => {
			cancelled = true;
			clearTimeout(slowTimer);
		};
	}, [reference]);

	return (
		<main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
				<div className="mb-5 flex items-center gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1b3b5f]/10">
						<Package className="h-5 w-5 text-[#1b3b5f]" aria-hidden />
					</span>
					<div className="min-w-0">
						<h1 className="font-semibold text-slate-900">Shipment documents</h1>
						<p className="truncate text-slate-500 text-sm">{decodeURIComponent(reference)}</p>
					</div>
				</div>

				{state.kind === "loading" && (
					<div className="py-8">
						<p className="flex items-center gap-2 text-slate-500 text-sm">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
						</p>
						{slow && (
							<p className="mt-2 text-slate-400 text-xs">
								This can take up to a minute if the service has been idle. It is still trying.
							</p>
						)}
					</div>
				)}

				{state.kind === "error" && <p className="py-6 text-rose-600 text-sm">{state.message}</p>}

				{state.kind === "found" && (
					<>
						{state.shipment.display_status && (
							<p className="mb-4 text-slate-600 text-sm">
								Status: <span className="font-semibold text-slate-900">{state.shipment.display_status}</span>
							</p>
						)}
						<PublicDocuments documents={state.shipment.documents} reference={state.shipment.shipment_reference} />
						{(state.shipment.documents ?? []).length === 0 && (
							<p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-slate-500 text-sm">
								Nothing has been attached to this shipment yet.
							</p>
						)}
					</>
				)}

				<Link
					href={`/?track=${encodeURIComponent(decodeURIComponent(reference))}`}
					className="mt-6 inline-flex items-center gap-1.5 font-semibold text-[#1b3b5f] text-sm hover:underline"
				>
					Track this shipment <ArrowRight className="h-4 w-4" aria-hidden />
				</Link>
			</div>
		</main>
	);
}
