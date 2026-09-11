// Shared helpers for the Stores & API screens (onboarding, the owner's stores and the admin list).

import type { Store } from "@/lib/api";
import { timeAgo, type Tone } from "@/lib/shipments";

/** Base URL shown in copy-paste examples. */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://obana-logistics-t6qg.onrender.com";

/** Ready-to-paste request that checks a key works. */
export const testCurl = (key: string) => `curl -H "Authorization: Bearer ${key}" ${PUBLIC_API_URL}/stores/me`;

export const storePath = (id: Store["id"]) => `/dashboard/customer/stores/${encodeURIComponent(String(id))}`;

export const storeStatusTone = (status?: string | null): Tone => (status === "active" ? "success" : "neutral");
export const storeStatusLabel = (status?: string | null) => (status === "active" ? "Active" : status === "paused" ? "Paused" : status || "Unknown");

export const BUSINESS_TYPES = [
	{ value: "online_store", label: "Online store" },
	{ value: "marketplace", label: "Marketplace" },
	{ value: "wholesaler", label: "Wholesaler" },
	{ value: "other", label: "Other" },
];

/** "adefashion.com" → "https://adefashion.com"; empty stays empty. */
export function normaliseWebsite(value: string) {
	const v = value.trim();
	if (!v) return "";
	return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function websiteError(value: string) {
	const v = normaliseWebsite(value);
	if (!v) return undefined;
	try {
		const u = new URL(v);
		return u.hostname.includes(".") ? undefined : "Enter a web address like yourstore.com.";
	} catch {
		return "Enter a web address like yourstore.com.";
	}
}

/** Webhooks must go to a public https address; empty means "no webhook". */
export function webhookError(value: string) {
	const v = value.trim();
	if (!v) return undefined;
	if (!/^https:\/\//i.test(v)) return "Must start with https://";
	try {
		const u = new URL(v);
		return u.hostname.includes(".") ? undefined : "Enter a full public address, e.g. https://yourstore.com/obana-webhook";
	} catch {
		return "Enter a full public address, e.g. https://yourstore.com/obana-webhook";
	}
}

export function storeNameError(value: string) {
	const v = value.trim();
	if (v.length < 2) return "Enter at least 2 characters.";
	if (v.length > 120) return "Keep it under 120 characters.";
	return undefined;
}

/** "https://www.adefashion.com/shop" → "adefashion.com/shop" for display. */
export function prettyUrl(url?: string | null) {
	if (!url) return "";
	return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/** Only link to http(s) addresses. */
export function safeHref(url?: string | null) {
	return url && /^https?:\/\//i.test(url) ? url : undefined;
}

export const lastUsedLabel = (value?: string | null) => (value ? timeAgo(value) || "Never used" : "Never used");
