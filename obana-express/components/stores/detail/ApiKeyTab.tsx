"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookOpen, KeyRound, RefreshCw } from "lucide-react";
import { Panel } from "@/components/dashboard/kit";
import { Button } from "@/components/ui";
import { KeyReveal } from "@/components/stores/KeyReveal";
import { ConfirmSheet, Sheet } from "@/components/stores/Sheet";
import { lastUsedLabel } from "@/components/stores/stores";
import { apiClient, type Store } from "@/lib/api";
import { formatDate } from "@/lib/shipments";
import { errorMessage } from "@/lib/useRemote";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 py-3 text-sm">
			<dt className="text-slate-500">{label}</dt>
			<dd className="min-w-0 text-right font-medium text-slate-900">{children}</dd>
		</div>
	);
}

export function ApiKeyTab({ store, onChanged }: { store: Store; onChanged: () => void }) {
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [newKey, setNewKey] = useState("");

	const rotate = async () => {
		setBusy(true);
		setError("");
		try {
			const res = await apiClient.rotateStoreKey(store.id);
			if (!res?.data?.api_key) throw new Error(res?.message || "We couldn't create a new key. Please try again.");
			setNewKey(res.data.api_key);
			setConfirming(false);
			onChanged();
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="grid gap-6 lg:grid-cols-5">
			<div className="min-w-0 lg:col-span-3">
				<Panel title="API key" description="Your store sends this key with every request. We only keep a hint of it.">
					<dl className="divide-y divide-slate-100">
						<Row label="Key">
							<span className="break-all font-mono">{store.api_key_hint}</span>
						</Row>
						<Row label="Created">{formatDate(store.api_key_created_at)}</Row>
						<Row label="Last used">{lastUsedLabel(store.last_used_at)}</Row>
					</dl>
					<div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm text-slate-600">Lost the key, or think someone else has it? Create a new one.</p>
						<Button
							variant="secondary"
							onClick={() => {
								setError("");
								setConfirming(true);
							}}
						>
							<RefreshCw className="h-4 w-4" aria-hidden /> Create new key
						</Button>
					</div>
				</Panel>
			</div>
			<div className="min-w-0 lg:col-span-2">
				<Panel title="Keep it safe">
					<ul className="space-y-3 text-sm text-slate-600">
						<li className="flex gap-2">
							<KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
							Use the key only on your server — never in a browser, app bundle or public repo.
						</li>
						<li className="flex gap-2">
							<KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
							Send it as <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">Authorization: Bearer &lt;key&gt;</code>
						</li>
					</ul>
					<Link href="/docs" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1B3B5F] hover:underline">
						<BookOpen className="h-4 w-4" aria-hidden /> API docs
					</Link>
				</Panel>
			</div>

			{confirming && (
				<ConfirmSheet
					title="Create a new API key?"
					subtitle={store.name}
					confirmLabel="Create new key"
					busyLabel="Creating…"
					danger
					busy={busy}
					error={error}
					onConfirm={rotate}
					onClose={() => setConfirming(false)}
				>
					<p>
						<strong className="text-slate-900">Your current key stops working immediately.</strong> Anything still using it — your website, Shopify app or server — will fail until you paste in the
						new key.
					</p>
				</ConfirmSheet>
			)}

			{newKey && (
				<Sheet title="Your new API key" subtitle={store.name} onClose={() => setNewKey("")} dismissible={false}>
					<KeyReveal apiKey={newKey} onDone={() => setNewKey("")} doneLabel="Done" />
				</Sheet>
			)}
		</div>
	);
}
