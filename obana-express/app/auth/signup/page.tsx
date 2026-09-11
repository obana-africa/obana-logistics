"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Eye, EyeOff, Lock, Mail, Package, PlugZap, Shield, Truck, Upload, UserRound } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { LocationInput } from "@/components/LocationInput";
import PhoneInput from "@/components/PhoneInput";
import { Alert, Button, Input, Select } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { dashboardFor } from "@/lib/site";
import { safeNextPath, withNext } from "@/components/quote/quote";

const subscribeNothing = () => () => {};
// ?next=/… returns people to where they were (e.g. booking a quote); anything unsafe is ignored.
const readNext = () => safeNextPath(new URLSearchParams(window.location.search).get("next"));

type Role = "customer" | "driver" | "agent";

const ROLES: { id: Role; label: string; description: string; icon: typeof Package }[] = [
	{ id: "customer", label: "Send & track shipments", description: "For individuals and businesses — from Europe to Africa and across Nigeria.", icon: Package },
	{ id: "driver", label: "Drive with Obana", description: "Accept delivery jobs near you and get paid for every delivery.", icon: Truck },
	{ id: "agent", label: "Become an agent", description: "Run operations in your area: shipments, customers and drivers.", icon: Shield },
];

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"first_name" | "last_name" | "email" | "phone" | "password" | "confirm" | "id_number" | "location", string>>;

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={shown ? "Hide password" : "Show password"}
			className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
		>
			{shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
		</button>
	);
}

function FilePick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
	return (
		<label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3.5 text-sm transition hover:border-[#1B3B5F]/40 hover:bg-slate-50">
			<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
				<Upload className="h-4 w-4" aria-hidden />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-medium text-slate-800">{label}</span>
				<span className="block truncate text-slate-500">{file ? file.name : "JPG or PNG — tap to choose"}</span>
			</span>
			<input type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
		</label>
	);
}

export default function SignupPage() {
	const router = useRouter();
	const { signup, error, clearError } = useAuth();
	const [role, setRole] = useState<Role | null>(null);
	const next = useSyncExternalStore(subscribeNothing, readNext, () => null);
	const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", password: "", confirm: "" });
	const [show, setShow] = useState({ password: false, confirm: false });
	const [agent, setAgent] = useState({
		government_id_type: "NIN",
		government_id_number: "",
		location: { city: "", state: "", country: "Nigeria", countryCode: "NG", stateCode: "" },
	});
	const [files, setFiles] = useState<{ government_id_image: File | null; profile_photo: File | null }>({ government_id_image: null, profile_photo: null });
	const [errors, setErrors] = useState<Errors>({});
	const [formError, setFormError] = useState("");
	const [loading, setLoading] = useState(false);

	const update = (field: keyof typeof form, value: string) => {
		setForm((f) => ({ ...f, [field]: value }));
		if (errors[field as keyof Errors]) setErrors((e) => ({ ...e, [field]: undefined }));
	};

	const validate = (): Errors => {
		const e: Errors = {};
		if (!form.first_name.trim()) e.first_name = "Enter your first name.";
		if (!form.last_name.trim()) e.last_name = "Enter your last name.";
		if (!EMAIL.test(form.email.trim())) e.email = "Enter a valid email address.";
		if (form.phone.replace(/\D/g, "").length < 8) e.phone = "Enter a valid phone number.";
		if (form.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
		if (form.confirm !== form.password) e.confirm = "The passwords don't match.";
		if (role === "agent") {
			if (!agent.government_id_number.trim()) e.id_number = "Enter your ID number.";
			if (!agent.location.state || !agent.location.city) e.location = "Choose your state and city.";
		}
		return e;
	};

	const upload = async (file: File | null) => {
		if (!file) return "";
		try {
			return await uploadToCloudinary(file);
		} catch {
			return "";
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();
		setFormError("");
		const found = validate();
		setErrors(found);
		if (Object.keys(found).length || !role) return;

		setLoading(true);
		try {
			let additional = {};
			if (role === "agent") {
				const [government_id_image, profile_photo] = await Promise.all([upload(files.government_id_image), upload(files.profile_photo)]);
				// Same fields the backend already expects for agents.
				additional = {
					government_id_type: agent.government_id_type,
					government_id_number: agent.government_id_number.trim(),
					country: agent.location.country,
					countryCode: agent.location.countryCode,
					state: agent.location.state,
					stateCode: agent.location.stateCode,
					city: agent.location.city,
					lga: "",
					assigned_zone: "",
					service_radius: "",
					latitude: "",
					longitude: "",
					government_id_image,
					profile_photo,
				};
			}
			const response = await signup(form.first_name.trim(), form.last_name.trim(), form.email.trim(), form.phone, form.password, role, additional);
			router.replace(next ?? dashboardFor(response?.data?.user ?? { role }));
		} catch (err) {
			setFormError(err instanceof Error ? err.message : "We couldn't create your account. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const selected = ROLES.find((r) => r.id === role);

	return (
		<AuthShell>
			{!role ? (
				<>
					<p className="text-sm font-semibold text-[#1B3B5F]">Step 1 of 2</p>
					<h2 className="mt-1 text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
						Create your account
					</h2>
					<p className="mt-2 text-slate-600">How will you use Obana?</p>

					<ul className="mt-8 space-y-3">
						{ROLES.map(({ id, label, description, icon: Icon }) => (
							<li key={id}>
								<button
									type="button"
									onClick={() => setRole(id)}
									className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#1B3B5F]/40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/15"
								>
									<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1B3B5F]/5 text-[#1B3B5F]">
										<Icon className="h-6 w-6" aria-hidden />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block font-semibold text-slate-900">{label}</span>
										<span className="mt-0.5 block text-sm text-slate-500">{description}</span>
									</span>
									<ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden />
								</button>
							</li>
						))}
					</ul>

					<Link
						href="/onboarding/business"
						className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
					>
						<PlugZap className="h-5 w-5 shrink-0" aria-hidden />
						<span className="flex-1">
							<strong className="font-semibold">Connecting a store or platform?</strong> Get an API key instead.
						</span>
						<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
					</Link>

					<p className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
						Already have an account?{" "}
						<Link href={next ? withNext("/auth/login", next) : "/auth/login"} className="font-semibold text-[#1B3B5F] hover:underline">
							Sign in
						</Link>
					</p>
				</>
			) : (
				<>
					<button type="button" onClick={() => setRole(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1B3B5F]">
						<ArrowLeft className="h-4 w-4" /> Change account type
					</button>
					<p className="mt-6 text-sm font-semibold text-[#1B3B5F]">Step 2 of 2 · {selected?.label}</p>
					<h2 className="mt-1 text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
						Your details
					</h2>

					{(error || formError) && (
						<Alert type="error" className="mt-6">
							{error || formError}
						</Alert>
					)}

					<form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
						<div className="grid gap-5 sm:grid-cols-2">
							<Input label="First name" autoComplete="given-name" required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} error={errors.first_name} icon={<UserRound />} />
							<Input label="Last name" autoComplete="family-name" required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} error={errors.last_name} />
						</div>
						<Input
							label="Email address"
							type="email"
							inputMode="email"
							autoComplete="email"
							placeholder="you@company.com"
							required
							value={form.email}
							onChange={(e) => update("email", e.target.value)}
							error={errors.email}
							icon={<Mail />}
						/>
						<PhoneInput label="Phone number" required value={form.phone} onChange={(v) => update("phone", v)} error={errors.phone} helperText="We send delivery updates to this number." />

						{role === "agent" && (
							<fieldset className="space-y-5 rounded-2xl border border-slate-200 p-4 sm:p-5">
								<legend className="px-1 text-sm font-semibold text-slate-900">Agent verification</legend>
								<div className="grid gap-5 sm:grid-cols-2">
									<Select
										label="ID type"
										value={agent.government_id_type}
										onChange={(e) => setAgent((a) => ({ ...a, government_id_type: e.target.value }))}
										options={[
											{ value: "NIN", label: "NIN" },
											{ value: "Passport", label: "International passport" },
											{ value: "VoterID", label: "Voter's card" },
										]}
									/>
									<Input
										label="ID number"
										required
										value={agent.government_id_number}
										onChange={(e) => {
											setAgent((a) => ({ ...a, government_id_number: e.target.value }));
											setErrors((er) => ({ ...er, id_number: undefined }));
										}}
										error={errors.id_number}
									/>
								</div>
								<div>
									<LocationInput label="Where you'll operate" required value={agent.location} onChange={(location) => setAgent((a) => ({ ...a, location }))} />
									{errors.location && <p className="mt-1.5 text-sm text-rose-600">{errors.location}</p>}
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<FilePick label="Government ID" file={files.government_id_image} onPick={(f) => setFiles((x) => ({ ...x, government_id_image: f }))} />
									<FilePick label="Profile photo" file={files.profile_photo} onPick={(f) => setFiles((x) => ({ ...x, profile_photo: f }))} />
								</div>
							</fieldset>
						)}

						<Input
							label="Password"
							type={show.password ? "text" : "password"}
							autoComplete="new-password"
							required
							value={form.password}
							onChange={(e) => update("password", e.target.value)}
							error={errors.password}
							helperText={`At least ${MIN_PASSWORD} characters.`}
							icon={<Lock />}
							trailing={<RevealButton shown={show.password} onToggle={() => setShow((s) => ({ ...s, password: !s.password }))} />}
						/>
						<Input
							label="Confirm password"
							type={show.confirm ? "text" : "password"}
							autoComplete="new-password"
							required
							value={form.confirm}
							onChange={(e) => update("confirm", e.target.value)}
							error={errors.confirm}
							icon={<Lock />}
							trailing={<RevealButton shown={show.confirm} onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} />}
						/>

						<Button type="submit" size="lg" fullWidth loading={loading}>
							{loading ? "Creating your account…" : "Create account"}
						</Button>
						<p className="text-center text-xs text-slate-500">
							By creating an account you agree to Obana&apos;s terms of service and privacy policy.
						</p>
					</form>
				</>
			)}
		</AuthShell>
	);
}
