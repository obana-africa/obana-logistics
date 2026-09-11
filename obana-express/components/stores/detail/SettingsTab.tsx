"use client";

import React, { useState } from "react";
import { Globe, Store as StoreIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/kit";
import { Alert, Button, Input } from "@/components/ui";
import { normaliseWebsite, storeNameError, websiteError } from "@/components/stores/stores";
import { apiClient, type Store } from "@/lib/api";
import { errorMessage } from "@/lib/useRemote";

export function SettingsTab({ store, onChanged }: { store: Store; onChanged: () => void }) {
	const [name, setName] = useState(store.name);
	const [website, setWebsite] = useState(store.website_url ?? "");
	const [errors, setErrors] = useState<{ name?: string; website?: string }>({});
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const changed = name.trim() !== store.name || normaliseWebsite(website) !== (store.website_url ?? "");

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		const errs = { name: storeNameError(name), website: websiteError(website) };
		setErrors(errs);
		if (errs.name || errs.website) return;
		setBusy(true);
		setNotice(null);
		try {
			const site = normaliseWebsite(website);
			await apiClient.updateStore(store.id, { name: name.trim(), website_url: site || null });
			setWebsite(site);
			setNotice({ type: "success", text: "Store details saved." });
			onChanged();
		} catch (err) {
			setNotice({ type: "error", text: errorMessage(err) });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="max-w-2xl">
			<Panel title="Store details">
				<form onSubmit={save} noValidate className="space-y-5">
					{notice && (
						<Alert type={notice.type} role="status">
							{notice.text}
						</Alert>
					)}
					<Input label="Store name" required maxLength={120} icon={<StoreIcon />} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
					<Input
						label="Store website"
						inputMode="url"
						icon={<Globe />}
						placeholder="yourstore.com"
						value={website}
						onChange={(e) => setWebsite(e.target.value)}
						error={errors.website}
						helperText="Leave empty if the store has no website (e.g. a phone app)."
					/>
					<Button type="submit" loading={busy} disabled={!changed}>
						{busy ? "Saving…" : "Save changes"}
					</Button>
				</form>
			</Panel>
		</div>
	);
}
