"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input, Textarea } from "@/components/ui";
import { apiClient } from "@/lib/api";

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);

export default function BusinessOnboardingPage() {
	const [form, setForm] = useState({ name: "", slug: "", base_url: "", description: "" });
	const [slugEdited, setSlugEdited] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const response = await apiClient.registerTenant(form.name.trim(), form.slug, form.base_url.trim(), form.description.trim());
			if (response?.data?.api_key) setApiKey(response.data.api_key);
			else setError(response?.message || "We couldn't create your API key. Please try again.");
		} catch (err) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
			setError(message || "Registration failed. Please check your details and try again.");
		} finally {
			setLoading(false);
		}
	};

	const copyKey = async () => {
		try {
			await navigator.clipboard.writeText(apiKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setShowKey(true); // clipboard blocked — show it so it can be copied by hand
		}
	};

	if (apiKey) {
		return (
			<AuthShell wide>
				<span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
					<CheckCircle2 className="h-7 w-7 text-emerald-600" />
				</span>
				<h2 className="mt-5 text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
					You&apos;re connected
				</h2>
				<p className="mt-2 text-slate-600">
					<strong className="text-slate-900">{form.name}</strong> is registered. Here is your API key.
				</p>

				<div className="mt-6 rounded-2xl bg-slate-900 p-4">
					<p className="text-xs font-medium uppercase tracking-wider text-slate-400">API key</p>
					<div className="mt-2 flex items-center gap-2">
						<code className="min-w-0 flex-1 break-all font-mono text-sm text-emerald-300">{showKey ? apiKey : "•".repeat(Math.min(apiKey.length, 32))}</code>
						<button
							type="button"
							onClick={() => setShowKey((s) => !s)}
							aria-label={showKey ? "Hide API key" : "Show API key"}
							className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
						>
							{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						</button>
						<button
							type="button"
							onClick={copyKey}
							className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
						>
							{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
							{copied ? "Copied" : "Copy"}
						</button>
					</div>
				</div>

				<Alert type="warning" className="mt-4">
					Store this key somewhere safe and only use it on your server. Anyone with it can create shipments for your business.
				</Alert>

				<ol className="mt-8 space-y-4">
					{[
						["Read the API docs", "See how to authenticate and create or track shipments."],
						["Add the key to your server", "Send it as Authorization: Bearer <your key> with each request."],
						["Create your first shipment", "Your customers get tracking links and updates automatically."],
					].map(([title, text], i) => (
						<li key={title} className="flex gap-3">
							<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B3B5F] text-sm font-bold text-white">{i + 1}</span>
							<div>
								<p className="font-semibold text-slate-900">{title}</p>
								<p className="text-sm text-slate-600">{text}</p>
							</div>
						</li>
					))}
				</ol>

				<div className="mt-8 grid gap-3 sm:grid-cols-2">
					<Link href="/docs">
						<Button size="lg" fullWidth>
							Open the API docs <ArrowRight className="h-4 w-4" />
						</Button>
					</Link>
					<Link href="/">
						<Button size="lg" variant="secondary" fullWidth>
							Back to home
						</Button>
					</Link>
				</div>
			</AuthShell>
		);
	}

	return (
		<AuthShell wide>
			<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B3B5F]/5 text-[#1B3B5F]">
				<KeyRound className="h-6 w-6" />
			</span>
			<h2 className="mt-5 text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
				Connect your platform
			</h2>
			<p className="mt-2 text-slate-600">Register your business to get an API key and create and track shipments from your own system.</p>

			{error && (
				<Alert type="error" className="mt-6">
					{error}
				</Alert>
			)}

			<form onSubmit={handleSubmit} className="mt-8 space-y-5">
				<Input
					label="Business or app name"
					required
					placeholder="e.g. Ade Fashion Store"
					value={form.name}
					onChange={(e) => {
						const name = e.target.value;
						setForm((f) => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }));
					}}
				/>
				<Input
					label="Short ID"
					required
					pattern="^[a-z0-9-]+$"
					placeholder="ade-fashion-store"
					value={form.slug}
					onChange={(e) => {
						setSlugEdited(true);
						setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
					}}
					helperText="Lowercase letters, numbers and hyphens. Filled in from your name — change it if you like."
				/>
				<Input
					label="Your platform's web address"
					type="url"
					required
					inputMode="url"
					placeholder="https://yourstore.com"
					value={form.base_url}
					onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
					helperText="Start with https://"
				/>
				<Textarea
					label="What will you ship? (optional)"
					rows={3}
					placeholder="e.g. Fashion orders from our online store, shipped from the UK to Nigeria and Ghana."
					value={form.description}
					onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
				/>
				<Button type="submit" size="lg" fullWidth loading={loading}>
					{loading ? "Creating your key…" : "Get my API key"}
				</Button>
			</form>

			<p className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
				Already registered?{" "}
				<Link href="/docs" className="font-semibold text-[#1B3B5F] hover:underline">
					Read the API docs
				</Link>
			</p>
		</AuthShell>
	);
}
