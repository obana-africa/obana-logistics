'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, UserRound, ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
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
 * Booking a shipment for a customer who rang in.
 *
 * It is the same form the customer fills; the only thing an admin does extra is
 * say who it is for. The shipment is then the customer's — it shows on their
 * dashboard and they can cancel it — with the admin recorded against it.
 */
function AdminNewShipmentPicker() {
	const params = useSearchParams();
	const router = useRouter();
	const chosenId = params.get('customer');

	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [q, setQ] = useState('');

	useEffect(() => {
		let live = true;
		(async () => {
			try {
				const res = await apiClient.getAllUsers();
				if (!live) return;
				const all: Customer[] = res?.data ?? [];
				setCustomers(all.filter((u) => (u.role ?? 'customer') === 'customer'));
			} catch (err) {
				const e = err as { response?: { data?: { message?: string } }; message?: string };
				// The server's message is in the body; AxiosError.message is only the status line.
				if (live) setError(e?.response?.data?.message ?? e?.message ?? 'Could not load customers.');
			} finally {
				if (live) setLoading(false);
			}
		})();
		return () => {
			live = false;
		};
	}, []);

	const chosen = useMemo(
		() => customers.find((c) => String(c.id) === String(chosenId)),
		[customers, chosenId],
	);

	const matches = useMemo(() => {
		const s = q.trim().toLowerCase();
		if (!s) return customers.slice(0, 60);
		const digits = s.replace(/\D/g, '');
		return customers
			.filter(
				(c) =>
					fullName(c).toLowerCase().includes(s) ||
					(c.email ?? '').toLowerCase().includes(s) ||
					(digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)),
			)
			.slice(0, 60);
	}, [customers, q]);

	// Once a customer is picked, this is just the customer's own booking form.
	if (chosenId) {
		return (
			<NewShipmentForm
				role="admin"
				onBehalfOf={String(chosenId)}
				onBehalfOfName={chosen ? fullName(chosen) : undefined}
			/>
		);
	}

	return (
		<DashboardLayout role="admin">
			<div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
				<Link
					href="/dashboard/admin/shipments"
					className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
				>
					<ArrowLeft size={16} />
					Shipments
				</Link>

				<h1 className="text-xl font-bold text-slate-900">Who is this shipment for?</h1>
				<p className="mt-1 text-sm text-slate-500">
					Pick the customer and the rest of the form is the one they would fill in themselves.
				</p>

				<div className="relative mt-5">
					<Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search by name, email or phone"
						aria-label="Search customers"
						className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-base outline-none transition focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
					/>
				</div>

				{loading ? (
					<div className="mt-4 space-y-2">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
						))}
					</div>
				) : error ? (
					<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
				) : matches.length === 0 ? (
					<p className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
						{customers.length === 0
							? 'There are no customers yet. Create one from Users first.'
							: `No customer matches “${q}”.`}
					</p>
				) : (
					<ul className="mt-4 space-y-2">
						{matches.map((c) => (
							<li key={c.id}>
								<button
									type="button"
									onClick={() => router.push(`/dashboard/admin/shipments/new?customer=${c.id}`)}
									className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[#1B3B5F]/40 hover:bg-slate-50"
								>
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
										<UserRound size={18} />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-semibold text-slate-900">{fullName(c)}</span>
										<span className="block truncate text-sm text-slate-500">
											{[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</DashboardLayout>
	);
}

/**
 * useSearchParams() opts the tree into client rendering, and without a boundary
 * Next fails the static export of this route. The fallback is the same shell
 * the picker renders, so nothing jumps when it hydrates.
 */
export default function AdminNewShipmentPage() {
	return (
		<Suspense
			fallback={
				<DashboardLayout role="admin">
					<div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
						<div className="h-8 w-56 animate-pulse rounded-lg bg-slate-100" />
						<div className="mt-5 h-12 w-full animate-pulse rounded-xl bg-slate-100" />
						<div className="mt-4 space-y-2">
							{[0, 1, 2, 3].map((i) => (
								<div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
							))}
						</div>
					</div>
				</DashboardLayout>
			}
		>
			<AdminNewShipmentPicker />
		</Suspense>
	);
}
