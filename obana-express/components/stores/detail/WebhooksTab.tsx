"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, RefreshCw, RotateCw, Send, Webhook } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Panel, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button, Input } from "@/components/ui";
import { CopyButton } from "@/components/stores/Copy";
import { ConfirmSheet } from "@/components/stores/Sheet";
import { webhookError } from "@/components/stores/stores";
import { apiClient, type Store, type StoreWebhookDelivery } from "@/lib/api";
import { timeAgo, type Tone } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

const DELIVERY: Record<StoreWebhookDelivery["status"], { label: string; tone: Tone }> = {
	delivered: { label: "Delivered", tone: "success" },
	failed: { label: "Failed", tone: "danger" },
	pending: { label: "Retrying", tone: "warning" },
};
const deliveryMeta = (d: StoreWebhookDelivery) => (d.status === "pending" && !d.attempts ? { label: "Queued", tone: "info" as Tone } : DELIVERY[d.status] ?? { label: d.status, tone: "neutral" as Tone });

type TestResult = { ok: boolean; code: number | null } | { error: string };

export function WebhooksTab({ store, onChanged }: { store: Store; onChanged: () => void }) {
	const saved = store.webhook_url ?? "";
	const [url, setUrl] = useState(saved);
	const [touched, setTouched] = useState(false);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const [showSecret, setShowSecret] = useState(false);
	const [confirmSecret, setConfirmSecret] = useState(false);
	const [secretBusy, setSecretBusy] = useState(false);
	const [secretError, setSecretError] = useState("");

	const [testing, setTesting] = useState(false);
	const [test, setTest] = useState<TestResult | null>(null);

	const deliveries = useRemote<StoreWebhookDelivery[]>(`store-webhooks:${store.id}`, async () => (await apiClient.listStoreWebhooks(store.id)).data ?? []);

	const urlError = touched ? webhookError(url) : undefined;
	const changed = url.trim() !== saved;

	const saveUrl = async (e: React.FormEvent) => {
		e.preventDefault();
		setTouched(true);
		if (webhookError(url)) return;
		setSaving(true);
		setNotice(null);
		try {
			const next = url.trim();
			await apiClient.updateStore(store.id, { webhook_url: next || null });
			setNotice({ type: "success", text: next ? "Webhook URL saved. Send a test event to check your server gets it." : "Webhook removed — we'll stop sending events." });
			setTest(null);
			onChanged();
		} catch (err) {
			setNotice({ type: "error", text: errorMessage(err) });
		} finally {
			setSaving(false);
		}
	};

	const rotateSecret = async () => {
		setSecretBusy(true);
		setSecretError("");
		try {
			await apiClient.rotateWebhookSecret(store.id);
			setConfirmSecret(false);
			setShowSecret(true);
			setNotice({ type: "success", text: "New signing secret created. Update it on your server — events are now signed with it." });
			onChanged();
		} catch (err) {
			setSecretError(errorMessage(err));
		} finally {
			setSecretBusy(false);
		}
	};

	const sendTest = async () => {
		setTesting(true);
		setTest(null);
		try {
			const res = await apiClient.testStoreWebhook(store.id);
			setTest({ ok: Boolean(res?.data?.ok), code: res?.data?.code ?? null });
		} catch (err) {
			setTest({ error: errorMessage(err) });
		} finally {
			setTesting(false);
			deliveries.retry();
		}
	};

	const secret = store.webhook_secret ?? "";
	const masked = secret ? `${secret.slice(0, 6)}${"•".repeat(24)}` : "—";
	const list = deliveries.data ?? [];

	return (
		<div className="space-y-6">
			{notice && (
				<Alert type={notice.type} role="status">
					{notice.text}
				</Alert>
			)}

			<div className="grid gap-6 lg:grid-cols-5">
				<div className="min-w-0 space-y-6 lg:col-span-3">
					<Panel title="Webhook URL" description="We POST an event to this address whenever one of this store's shipments is created or changes.">
						<form onSubmit={saveUrl} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
							<div className="min-w-0 flex-1">
								<Input
									label="Endpoint"
									inputMode="url"
									placeholder="https://yourstore.com/obana-webhook"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									onBlur={() => setTouched(true)}
									error={urlError}
									helperText="Must be a public https:// address. Leave empty to turn webhooks off."
								/>
							</div>
							<Button type="submit" className="sm:mt-7" loading={saving} disabled={!changed}>
								{saving ? "Saving…" : "Save"}
							</Button>
						</form>

						<div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-slate-600">{saved ? "Send a sample shipment.updated event to your endpoint." : "Save a webhook URL to send a test event."}</p>
							<Button variant="secondary" onClick={sendTest} loading={testing} disabled={!saved}>
								<Send className="h-4 w-4" aria-hidden /> {testing ? "Sending…" : "Send test event"}
							</Button>
						</div>
						{test && (
							<div className="mt-3">
								{"error" in test ? (
									<Alert type="error">Test event couldn&apos;t be sent: {test.error}</Alert>
								) : test.ok ? (
									<Alert type="success">
										Test event delivered — your server answered <strong>HTTP {test.code ?? 200}</strong>.
									</Alert>
								) : (
									<Alert type="error">
										Test event failed —{" "}
										{test.code ? (
											<>
												your server answered <strong>HTTP {test.code}</strong>. It must reply with a 2xx code.
											</>
										) : (
											"no response from your server (it may be down, too slow or blocking us)."
										)}
									</Alert>
								)}
							</div>
						)}
					</Panel>

					<Panel
						title="Recent deliveries"
						description="The last 50 events we sent. Failed ones are retried automatically."
						flush
						actions={
							<button
								type="button"
								onClick={deliveries.retry}
								disabled={deliveries.loading}
								className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
							>
								<RotateCw className={`h-4 w-4 ${deliveries.loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
							</button>
						}
					>
						{deliveries.loading && !deliveries.data ? (
							<ListSkeleton rows={3} />
						) : deliveries.error ? (
							<ErrorState text={deliveries.error} onRetry={deliveries.retry} />
						) : !list.length ? (
							<EmptyState icon={Webhook} title="No events sent yet" text={saved ? "Events appear here as your shipments change — or send a test event." : "Add a webhook URL to start receiving events."} />
						) : (
							<>
								<ul className="divide-y divide-slate-100 sm:hidden">
									{list.map((d) => {
										const m = deliveryMeta(d);
										return (
											<li key={d.id} className="flex items-start justify-between gap-3 px-4 py-3">
												<div className="min-w-0">
													<p className="truncate font-mono text-sm font-semibold text-slate-900">{d.event}</p>
													<p className="text-xs text-slate-500">
														{timeAgo(d.created_at)} · {d.attempts} {d.attempts === 1 ? "attempt" : "attempts"}
														{d.response_code ? ` · HTTP ${d.response_code}` : ""}
													</p>
												</div>
												<ToneBadge tone={m.tone}>{m.label}</ToneBadge>
											</li>
										);
									})}
								</ul>
								<div className="hidden overflow-x-auto sm:block">
									<table className="w-full text-left text-sm">
										<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
											<tr>
												<th className="px-5 py-3">Event</th>
												<th className="px-5 py-3">Status</th>
												<th className="px-5 py-3 text-right">Attempts</th>
												<th className="px-5 py-3 text-right">Code</th>
												<th className="px-5 py-3">Time</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{list.map((d) => {
												const m = deliveryMeta(d);
												return (
													<tr key={d.id} className="hover:bg-slate-50">
														<td className="px-5 py-3 font-mono text-slate-900">{d.event}</td>
														<td className="px-5 py-3">
															<ToneBadge tone={m.tone}>{m.label}</ToneBadge>
														</td>
														<td className="px-5 py-3 text-right tabular-nums text-slate-700">{d.attempts}</td>
														<td className="px-5 py-3 text-right tabular-nums text-slate-700">{d.response_code ?? "—"}</td>
														<td className="whitespace-nowrap px-5 py-3 text-slate-600">{timeAgo(d.created_at)}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</>
						)}
					</Panel>
				</div>

				<div className="min-w-0 space-y-6 lg:col-span-2">
					<Panel title="Signing secret" description="Use it on your server to check each event really came from Obana.">
						<div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
							<code data-testid="webhook-secret" className="min-w-0 flex-1 truncate font-mono text-sm text-slate-900">
								{showSecret ? secret || "—" : masked}
							</code>
							<button
								type="button"
								onClick={() => setShowSecret((s) => !s)}
								disabled={!secret}
								className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
							>
								{showSecret ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
								{showSecret ? "Hide" : "Reveal"}
							</button>
							{secret && <CopyButton text={secret} />}
						</div>
						<Button
							variant="secondary"
							className="mt-4"
							fullWidth
							onClick={() => {
								setSecretError("");
								setConfirmSecret(true);
							}}
						>
							<RefreshCw className="h-4 w-4" aria-hidden /> Create new secret
						</Button>
					</Panel>

					<Panel title="How webhooks work">
						<div className="space-y-3 text-sm text-slate-600">
							<p>We send two events as JSON:</p>
							<ul className="space-y-2">
								<li>
									<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">shipment.created</code> — a new shipment was booked for this store.
								</li>
								<li>
									<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">shipment.updated</code> — its status or tracking changed.
								</li>
							</ul>
							<p>
								Each request carries an <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">Obana-Signature: t=…,v1=…</code> header. Check it with
								your signing secret before trusting the event, and reply with a 2xx code.
							</p>
							<Link href="/docs#webhooks" className="inline-flex items-center gap-1 font-semibold text-[#1B3B5F] hover:underline">
								Webhook docs
							</Link>
						</div>
					</Panel>
				</div>
			</div>

			{confirmSecret && (
				<ConfirmSheet
					title="Create a new signing secret?"
					subtitle={store.name}
					confirmLabel="Create new secret"
					busyLabel="Creating…"
					danger
					busy={secretBusy}
					error={secretError}
					onConfirm={rotateSecret}
					onClose={() => setConfirmSecret(false)}
				>
					<p>Events are signed with the new secret straight away. Until you update it on your server, its signature checks will fail.</p>
				</ConfirmSheet>
			)}
		</div>
	);
}
