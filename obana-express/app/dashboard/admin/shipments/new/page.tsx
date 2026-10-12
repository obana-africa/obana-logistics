'use client';

import React, { useEffect, useMemo, useState } from 'react';
import NewShipmentForm from '@/components/shipments/NewShipmentForm';
import { apiClient } from '@/lib/api';

type Customer = {
	id: string | number;
	first_name?: string;
	last_name?: string;
	name?: string;
	email?: string;
	phone?: string;
	role?: string;
};

const fullName = (c: Customer) =>
	(c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Unnamed').trim();

/**
 * An admin creating a shipment.
 *
 * This is the customer's own booking form, opened directly — an admin has
 * always been allowed to create a shipment (POST /shipments carries no role
 * guard), so nothing gates it. Choosing a customer is optional and only
 * changes who the shipment ends up belonging to.
 */
export default function AdminNewShipmentPage() {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [chosenId, setChosenId] = useState('');

	useEffect(() => {
		let live = true;
		(async () => {
			try {
				const res = await apiClient.getAllUsers();
				if (!live) return;
				const all: Customer[] = res?.data ?? [];
				setCustomers(all.filter((u) => (u.role ?? 'customer') === 'customer'));
			} catch {
				// The picker is optional — if the list will not load, the admin can
				// still book the shipment, it just belongs to the admin account.
				if (live) setCustomers([]);
			}
		})();
		return () => {
			live = false;
		};
	}, []);

	const chosen = useMemo(
		() => customers.find((c) => String(c.id) === chosenId),
		[customers, chosenId],
	);

	const picker = customers.length > 0 && (
		<label className="mt-3 block max-w-sm">
			<span className="text-sm font-semibold text-slate-700">Create for</span>
			<select
				value={chosenId}
				onChange={(e) => setChosenId(e.target.value)}
				className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
			>
				<option value="">This admin account</option>
				{customers.map((c) => (
					<option key={c.id} value={String(c.id)}>
						{fullName(c)}
						{c.phone ? ` · ${c.phone}` : c.email ? ` · ${c.email}` : ''}
					</option>
				))}
			</select>
		</label>
	);

	return (
		<NewShipmentForm
			role="admin"
			onBehalfOf={chosenId || undefined}
			onBehalfOfName={chosen ? fullName(chosen) : undefined}
			customerPicker={picker}
		/>
	);
}
