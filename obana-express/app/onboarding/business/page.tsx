"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, LayoutDashboard, PlugZap, Truck } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import PhoneInput from "@/components/PhoneInput";
import { Alert, Button, Input, Loader, Select } from "@/components/ui";
import { KeyReveal } from "@/components/stores/KeyReveal";
import { StoreFields, emptyStoreDraft, storeDraftBody, validateStoreDraft, type StoreDraftErrors } from "@/components/stores/StoreFields";
import { BUSINESS_TYPES, normaliseWebsite, storePath, websiteError } from "@/components/stores/stores";
import { withNext } from "@/components/quote/quote";
import { apiClient, type StoreWithKey } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { errorMessage } from "@/lib/useRemote";

const HERE = "/onboarding/business";
const display = { fontFamily: "var(--font-display)" } as const;
const subscribeNothing = () => () => {};

type Step = "business" | "store" | "key" | "done";
const STEPS: { id: Exclude<Step, "done">; label: string }[] = [
	{ id: "business", label: "Your business" },
	{ id: "store", label: "Connect a store" },
	{ id: "key", label: "Your API key" },
];

function Stepper({ step }: { step: Step }) {
	const current = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.id === step);
	return (
		<ol className="flex items-center gap-2" aria-label="Setup progress">
			{STEPS.map((s, i) => {
				const done = i < current;
				const active = i === current;
				return (
					<li key={s.id} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
						<span
							className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
								done ? "bg-emerald-500 text-white" : active ? "bg-[#1B3B5F] text-white" : "bg-slate-100 text-slate-500"
							}`}
						>
							{done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
						</span>
						<span className={`truncate text-xs font-semibold sm:text-sm ${active ? "text-slate-900" : "text-slate-500"}`}>
							{s.label}
							{done && <span className="sr-only"> (done)</span>}
						</span>
						{i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-slate-200 sm:block" aria-hidden />}
					</li>
				);
			})}
		</ol>
	);
}

function LoggedOut() {
	return (
		<>
			<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B3B5F]/5 text-[#1B3B5F]">
				<PlugZap className="h-6 w-6" aria-hidden />
			</span>
			<h1 className="mt-5 text-3xl font-bold text-slate-900" style={display}>
				Connect your store to Obana
			</h1>
			<p className="mt-2 text-slate-600">Ship your online orders from Europe to Africa and across Nigeria, straight from your website, Shopify shop or app.</p>

			<ul className="mt-8 space-y-4">
				{[
					{ icon: PlugZap, title: "Connect your store", text: "Add your website, Shopify shop or app and get its own API key." },
					{ icon: Truck, title: "We price and deliver", text: "Your checkout shows live shipping prices; we pick up and deliver every order." },
					{ icon: LayoutDashboard, title: "You see every order and customer", text: "One dashboard per store with its shipments, customers and live status." },
				].map(({ icon: Icon, title, text }) => (
					<li key={title} className="flex gap-3">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
							<Icon className="h-5 w-5" aria-hidden />
						</span>
						<span>
							<strong className="block text-slate-900">{title}</strong>
							<span className="text-sm text-slate-600">{text}</span>
						</span>
					</li>
				))}
			</ul>

			<div className="mt-8 grid gap-3">
				<Link
					href={withNext("/auth/signup", HERE)}
					className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1B3B5F] px-6 text-base font-semibold text-white hover:bg-[#15304d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20"
				>
					Create a business account <ArrowRight className="h-4 w-4" aria-hidden />
				</Link>
				<Link
					href={withNext("/auth/login", HERE)}
					className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20"
				>
					I already have an account
				</Link>
			</div>
			<p className="mt-6 text-center text-sm text-slate-500">Every store belongs to an Obana account, so only you can see and change its API keys.</p>
		</>
	);
}

type Business = { name: string; website: string; phone: string; type: string };
type User = { attributes?: { business_name?: string; business_website?: string; business_phone?: string; business_type?: string } | null } | null;

const phoneDigits = (p: string) => p.replace(/\D/g, "");

function Wizard({ user }: { user: User }) {
	const { refreshProfile } = useAuth();
	const a = user?.attributes ?? {};
	const saved: Business = { name: a.business_name ?? "", website: a.business_website ?? "", phone: a.business_phone ?? "", type: a.business_type ?? "" };

	const [step, setStep] = useState<Step>("business");
	const [biz, setBiz] = useState<Business>(saved);
	const [bizErrors, setBizErrors] = useState<Partial<Record<keyof Business, string>>>({});
	const [draft, setDraft] = useState(emptyStoreDraft);
	const [storeErrors, setStoreErrors] = useState<StoreDraftErrors>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [created, setCreated] = useState<StoreWithKey | null>(null);

	const saveBusiness = async (e: React.FormEvent) => {
		e.preventDefault();
		const errs: typeof bizErrors = {};
		if (biz.name.trim().length < 2) errs.name = "Enter your business name.";
		const site = websiteError(biz.website);
		if (site) errs.website = site;
		if (biz.phone && phoneDigits(biz.phone).length > 0 && phoneDigits(biz.phone).length < 8) errs.phone = "Enter a valid phone number.";
		setBizErrors(errs);
		if (Object.keys(errs).length) return;

		const body: { business_name: string; business_website?: string; business_phone?: string; business_type?: string } = { business_name: biz.name.trim() };
		const website = normaliseWebsite(biz.website);
		if (website) body.business_website = website;
		if (phoneDigits(biz.phone).length >= 8) body.business_phone = `+${phoneDigits(biz.phone)}`;
		if (biz.type) body.business_type = biz.type;

		const unchanged =
			Boolean(saved.name) &&
			body.business_name === saved.name &&
			(body.business_website ?? "") === saved.website &&
			phoneDigits(body.business_phone ?? "") === phoneDigits(saved.phone) &&
			(body.business_type ?? "") === saved.type;

		setError("");
		const goNext = () => {
			setDraft((d) => (d.name || d.website ? d : { ...d, name: body.business_name, website: body.business_website ?? "" }));
			setStep("store");
		};
		if (unchanged) return goNext();

		setBusy(true);
		try {
			await apiClient.updateProfile(body);
			await refreshProfile();
			goNext();
		} catch (err) {
			setError(errorMessage(err, "We couldn't save your business details. Please try again."));
		} finally {
			setBusy(false);
		}
	};

	const createStore = async (e: React.FormEvent) => {
		e.preventDefault();
		const errs = validateStoreDraft(draft);
		setStoreErrors(errs);
		if (Object.keys(errs).length) return;
		setBusy(true);
		setError("");
		try {
			const res = await apiClient.createStore(storeDraftBody(draft));
			if (!res?.data?.api_key) throw new Error(res?.message || "We couldn't create your store. Please try again.");
			setCreated(res.data);
			setStep("key");
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	const heading: Record<Step, { title: string; text: string }> = {
		business: { title: "Your business", text: saved.name ? "Check your details and continue." : "Tell us who you are. You can change this later." },
		store: { title: "Connect your first store", text: "A store is your website, Shopify shop or app. It gets its own API key." },
		key: { title: "Your API key", text: "Your store uses this key to price and create shipments." },
		done: { title: "You're connected", text: "Your store is ready to send orders to Obana." },
	};

	return (
		<>
			<Stepper step={step} />
			<h1 className="mt-8 text-3xl font-bold text-slate-900" style={display}>
				{heading[step].title}
			</h1>
			<p className="mt-2 text-slate-600">{heading[step].text}</p>

			{error && (
				<Alert type="error" className="mt-6">
					{error}
				</Alert>
			)}

			{step === "business" && (
				<form onSubmit={saveBusiness} noValidate className="mt-8 space-y-5">
					<Input
						label="Business name"
						required
						autoComplete="organization"
						placeholder="e.g. Ade Fashion Ltd"
						value={biz.name}
						onChange={(e) => setBiz({ ...biz, name: e.target.value })}
						error={bizErrors.name}
					/>
					<Input
						label="Website"
						inputMode="url"
						autoComplete="url"
						placeholder="yourbusiness.com"
						value={biz.website}
						onChange={(e) => setBiz({ ...biz, website: e.target.value })}
						error={bizErrors.website}
					/>
					<PhoneInput label="Business phone" value={biz.phone} onChange={(v) => setBiz({ ...biz, phone: v })} error={bizErrors.phone} helperText="For delivery questions about your orders." />
					<Select label="Type of business" placeholder="Choose one" value={biz.type} onChange={(e) => setBiz({ ...biz, type: e.target.value })} options={BUSINESS_TYPES} />
					<Button type="submit" size="lg" fullWidth loading={busy}>
						{busy ? "Saving…" : "Continue"} {!busy && <ArrowRight className="h-4 w-4" aria-hidden />}
					</Button>
				</form>
			)}

			{step === "store" && (
				<form onSubmit={createStore} noValidate className="mt-8 space-y-5">
					<StoreFields value={draft} onChange={setDraft} errors={storeErrors} />
					<div className="grid gap-3 sm:grid-cols-[auto_1fr]">
						<Button
							type="button"
							variant="secondary"
							size="lg"
							onClick={() => {
								setError("");
								setStep("business");
							}}
							disabled={busy}
						>
							<ArrowLeft className="h-4 w-4" aria-hidden /> Back
						</Button>
						<Button type="submit" size="lg" fullWidth loading={busy}>
							{busy ? "Creating your key…" : "Create store & API key"}
						</Button>
					</div>
				</form>
			)}

			{step === "key" && created && (
				<div className="mt-8">
					<KeyReveal apiKey={created.api_key} storeName={created.store.name} onDone={() => setStep("done")} />
				</div>
			)}

			{step === "done" && created && (
				<div className="mt-8 space-y-6">
					<div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
						<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
						<p>
							<strong className="font-semibold">{created.store.name}</strong> is connected. Its shipments, customers and webhook settings are on the store page.
						</p>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<Link
							href={storePath(created.store.id)}
							className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1B3B5F] px-6 text-base font-semibold text-white hover:bg-[#15304d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20"
						>
							Go to your store <ArrowRight className="h-4 w-4" aria-hidden />
						</Link>
						<Link
							href="/docs"
							className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20"
						>
							<BookOpen className="h-4 w-4" aria-hidden /> Read the API docs
						</Link>
					</div>
				</div>
			)}

			{step !== "done" && step !== "key" && (
				<p className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
					Already connected a store?{" "}
					<Link href="/dashboard/customer/stores" className="font-semibold text-[#1B3B5F] hover:underline">
						Go to Stores & API
					</Link>
				</p>
			)}
		</>
	);
}

export default function BusinessOnboardingPage() {
	const { user, isAuthenticated, isLoading } = useAuth();
	// The saved sign-in only exists in the browser; wait for it so the server and first client render agree.
	const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

	return (
		<AuthShell wide>
			{/* AuthShell is a CSS grid: `w-0 min-w-full` stops long unbreakable content (curl line, stepper labels) widening it past a phone screen. */}
			<div className="w-0 min-w-full">{!hydrated || isLoading ? <Loader className="py-24" label="Loading" /> : isAuthenticated && user ? <Wizard user={user} /> : <LoggedOut />}</div>
		</AuthShell>
	);
}
