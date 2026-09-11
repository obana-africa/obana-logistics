"use client";

import React, { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { KeyReveal } from "@/components/stores/KeyReveal";
import { Sheet } from "@/components/stores/Sheet";
import { StoreFields, emptyStoreDraft, storeDraftBody, validateStoreDraft, type StoreDraftErrors } from "@/components/stores/StoreFields";
import { apiClient, type StoreWithKey } from "@/lib/api";
import { errorMessage } from "@/lib/useRemote";

/** "Add store" form that ends in the one-time key reveal. */
export function AddStoreSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (created: StoreWithKey) => void }) {
	const [draft, setDraft] = useState(emptyStoreDraft);
	const [errors, setErrors] = useState<StoreDraftErrors>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [created, setCreated] = useState<StoreWithKey | null>(null);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const errs = validateStoreDraft(draft);
		setErrors(errs);
		if (Object.keys(errs).length) return;
		setBusy(true);
		setError("");
		try {
			const res = await apiClient.createStore(storeDraftBody(draft));
			if (!res?.data?.api_key) throw new Error(res?.message || "We couldn't create the store. Please try again.");
			setCreated(res.data);
			onCreated(res.data);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	if (created) {
		return (
			<Sheet title="Your API key" subtitle={created.store.name} onClose={onClose} dismissible={false}>
				<KeyReveal apiKey={created.api_key} onDone={onClose} doneLabel="Done" />
			</Sheet>
		);
	}

	return (
		<Sheet title="Add a store" subtitle="Each store gets its own API key." onClose={() => !busy && onClose()}>
			<form onSubmit={submit} noValidate className="space-y-5">
				{error && <Alert type="error">{error}</Alert>}
				<StoreFields value={draft} onChange={setDraft} errors={errors} />
				<Button type="submit" size="lg" fullWidth loading={busy}>
					{busy ? "Creating your key…" : "Create store & API key"}
				</Button>
			</form>
		</Sheet>
	);
}
