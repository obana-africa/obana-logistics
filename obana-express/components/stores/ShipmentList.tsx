"use client";

import React from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/kit";
import { CopyButton } from "@/components/stores/Copy";
import type { StoreShipment } from "@/lib/api";
import { formatDate, formatMoney, placeLabel } from "@/lib/shipments";

export const shipmentHref = (s: StoreShipment) => `/dashboard/customer/shipments/${encodeURIComponent(s.reference)}`;
const customerName = (s: StoreShipment) => s.customer?.name || s.destination?.name || "—";

/** A store's shipments: cards on phones and tablets, a table on desktop. */
export function StoreShipmentList({ shipments }: { shipments: StoreShipment[] }) {
	return (
		<>
			<ul className="divide-y divide-slate-100 lg:hidden">
				{shipments.map((s) => (
					<li key={s.id} className="px-4 py-4">
						<Link href={shipmentHref(s)} className="block rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-semibold text-slate-900">{s.order_id ? `Order ${s.order_id}` : s.reference}</p>
									<p className="truncate font-mono text-xs text-slate-500">{s.reference}</p>
								</div>
								<StatusBadge status={s.status} />
							</div>
							<div className="mt-2 flex items-end justify-between gap-3 text-sm">
								<p className="min-w-0 truncate text-slate-500">
									{customerName(s)} · {placeLabel(s.destination)} · {formatDate(s.created_at)}
								</p>
								<span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatMoney(s.shipping_fee, s.currency || "NGN")}</span>
							</div>
						</Link>
						{s.tracking_url && (
							<div className="mt-3">
								<CopyButton text={s.tracking_url} label="Copy tracking link" copiedLabel="Link copied" />
							</div>
						)}
					</li>
				))}
			</ul>

			<div className="hidden overflow-x-auto lg:block">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-5 py-3">Order</th>
							<th className="px-5 py-3">Customer</th>
							<th className="px-5 py-3">Destination</th>
							<th className="px-5 py-3">Status</th>
							<th className="px-5 py-3 text-right">Fee</th>
							<th className="px-5 py-3">Created</th>
							<th className="px-5 py-3">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{shipments.map((s) => (
							<tr key={s.id} className="group hover:bg-slate-50">
								<td className="px-5 py-3.5">
									<Link href={shipmentHref(s)} className="font-semibold text-[#1B3B5F] group-hover:underline">
										{s.order_id || "No order ID"}
									</Link>
									<p className="font-mono text-xs text-slate-500">{s.reference}</p>
								</td>
								<td className="max-w-[12rem] px-5 py-3.5">
									<p className="truncate text-slate-800">{customerName(s)}</p>
									{s.customer?.email && <p className="truncate text-xs text-slate-500">{s.customer.email}</p>}
								</td>
								<td className="px-5 py-3.5 text-slate-700">{placeLabel(s.destination)}</td>
								<td className="px-5 py-3.5">
									<StatusBadge status={s.status} />
								</td>
								<td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatMoney(s.shipping_fee, s.currency || "NGN")}</td>
								<td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(s.created_at)}</td>
								<td className="px-5 py-3.5 text-right">{s.tracking_url && <CopyButton text={s.tracking_url} label="Copy tracking link" copiedLabel="Link copied" />}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
