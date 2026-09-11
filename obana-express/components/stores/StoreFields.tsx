"use client";

import React from "react";
import { Globe, Store as StoreIcon, Webhook } from "lucide-react";
import { Input } from "@/components/ui";
import { normaliseWebsite, storeNameError, webhookError, websiteError } from "@/components/stores/stores";

export type StoreDraft = { name: string; website: string; webhook: string };
export const emptyStoreDraft: StoreDraft = { name: "", website: "", webhook: "" };

export type StoreDraftErrors = Partial<Record<keyof StoreDraft, string>>;

export function validateStoreDraft(d: StoreDraft): StoreDraftErrors {
	const e: StoreDraftErrors = {};
	const name = storeNameError(d.name);
	if (name) e.name = name;
	const site = websiteError(d.website);
	if (site) e.website = site;
	const hook = webhookError(d.webhook);
	if (hook) e.webhook = hook;
	return e;
}

/** Body for POST /stores — optional fields are left out when empty. */
export function storeDraftBody(d: StoreDraft) {
	const body: { name: string; website_url?: string; webhook_url?: string } = { name: d.name.trim() };
	const site = normaliseWebsite(d.website);
	if (site) body.website_url = site;
	if (d.webhook.trim()) body.webhook_url = d.webhook.trim();
	return body;
}

/** Store name, website and optional webhook URL — used by onboarding step 2 and the "Add store" sheet. */
export function StoreFields({ value, onChange, errors }: { value: StoreDraft; onChange: (next: StoreDraft) => void; errors: StoreDraftErrors }) {
	return (
		<div className="space-y-5">
			<Input
				label="Store name"
				required
				maxLength={120}
				icon={<StoreIcon />}
				placeholder="e.g. Ade Fashion — Shopify"
				value={value.name}
				onChange={(e) => onChange({ ...value, name: e.target.value })}
				error={errors.name}
				helperText="Only you see this. Name it after the shop or app it connects."
			/>
			<Input
				label="Store website"
				inputMode="url"
				autoComplete="url"
				icon={<Globe />}
				placeholder="yourstore.com"
				value={value.website}
				onChange={(e) => onChange({ ...value, website: e.target.value })}
				error={errors.website}
			/>
			<Input
				label="Webhook URL (optional)"
				inputMode="url"
				icon={<Webhook />}
				placeholder="https://yourstore.com/obana-webhook"
				value={value.webhook}
				onChange={(e) => onChange({ ...value, webhook: e.target.value })}
				error={errors.webhook}
				helperText="We'll send shipment updates here as they happen. Must be a public https:// address — you can add it later."
			/>
		</div>
	);
}
