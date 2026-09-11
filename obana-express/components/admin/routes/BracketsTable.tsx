import React from "react";
import { formatMoney } from "@/lib/shipments";
import { bracketUnitPrice, formatKg, formatPerKg, routeTitle, sortedBrackets, type RouteTemplate } from "./model";

/** A route's weight brackets as a plain table — readable on phones, no hover needed. */
export function BracketsTable({ route, id }: { route: RouteTemplate; id: string }) {
	const rows = sortedBrackets(route);
	if (!rows.length) {
		return (
			<p id={id} className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
				No weight brackets on this route yet — edit it to add prices.
			</p>
		);
	}
	return (
		<div id={id} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
			<table className="w-full text-left text-sm">
				<caption className="sr-only">Weight brackets for {routeTitle(route)}</caption>
				<thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
					<tr>
						<th scope="col" className="px-3 py-2 sm:px-4">
							Weight
						</th>
						<th scope="col" className="px-3 py-2 text-right sm:px-4">
							Price
						</th>
						<th scope="col" className="px-3 py-2 sm:px-4">
							ETA
						</th>
						<th scope="col" className="hidden px-3 py-2 text-right sm:table-cell sm:px-4">
							₦/kg
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-100">
					{rows.map((b, i) => {
						const perKg = formatPerKg(bracketUnitPrice(b));
						return (
							<tr key={i}>
								<td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800 sm:px-4">
									{formatKg(b.min)}–{formatKg(b.max)} kg
								</td>
								<td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 sm:px-4">
									{formatMoney(b.price)}
									{/* Phones: per-kg rate sits under the price so the table fits without sideways scrolling. */}
									<span className="block text-xs font-normal text-slate-500 sm:hidden">{perKg}</span>
								</td>
								<td className="whitespace-nowrap px-3 py-2.5 text-slate-700 sm:px-4">{b.eta || "—"}</td>
								<td className="hidden whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600 sm:table-cell sm:px-4">{perKg}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
