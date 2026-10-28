'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Alert, Button, Card, Input, Loader } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

/**
 * The administrator's own account.
 *
 * Every other role had one of these and admin did not, so the one person who
 * can see every shipment on the platform could not see their own name, and
 * had no way to find out which number the system holds for them. That number
 * matters: a shipment with no reachable contact falls back to the account
 * holder, so it is the address of last resort for the whole service.
 *
 * Deliberately the same shape as the agent and driver pages — name, phone,
 * email — rather than a new idea about what an account page is.
 */
export default function AdminProfilePage() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState({ type: '', text: '' });
	const [email, setEmail] = useState('');
	const [role, setRole] = useState('');
	const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' });

	useEffect(() => {
		(async () => {
			try {
				const response = await apiClient.getProfile();
				const u = response?.data;
				if (u) {
					setForm({
						first_name: u.attributes?.first_name || '',
						last_name: u.attributes?.last_name || '',
						phone: u.phone || '',
					});
					setEmail(u.email || '');
					setRole(u.attributes?.role || u.account_type || 'admin');
				}
			} catch {
				setMessage({ type: 'error', text: 'We could not load your account just now. Please try again.' });
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setMessage({ type: '', text: '' });
		try {
			await apiClient.updateProfile(form);
			setMessage({ type: 'success', text: 'Saved.' });
		} catch (err: any) {
			setMessage({
				type: 'error',
				text: err?.response?.data?.message || 'That did not save. Please try again.',
			});
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<DashboardLayout role="admin">
				<Loader />
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout role="admin">
			<div className="mx-auto max-w-2xl space-y-4">
				<div>
					<h1 className="font-semibold text-slate-900 text-xl">Your account</h1>
					<p className="text-slate-600 text-sm">
						The name and number Obana holds for you.
					</p>
				</div>

				{message.text && (
					<Alert type={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
				)}

				<Card>
					<form onSubmit={save} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								label="First name"
								value={form.first_name}
								onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
							/>
							<Input
								label="Last name"
								value={form.last_name}
								onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
							/>
						</div>

						<Input
							label="Phone number"
							value={form.phone}
							onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
							helperText="A shipment with no reachable contact falls back to this number, so it is worth keeping right."
						/>

						{/* Read-only, because neither is changed from here: the
						    address signs you in, and the role is granted rather
						    than chosen. Shown because not knowing which account
						    you are signed in as is the thing this page exists
						    to answer. */}
						<Input label="Email" value={email} readOnly disabled />
						<Input label="Role" value={role} readOnly disabled />

						<Button type="submit" loading={saving}>
							Save changes
						</Button>
					</form>
				</Card>
			</div>
		</DashboardLayout>
	);
}
