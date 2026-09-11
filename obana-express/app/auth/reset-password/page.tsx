"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input, Skeleton } from "@/components/ui";
import { API_BASE_URL } from "@/lib/site";

const MIN_PASSWORD = 8;

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

function ResetPasswordForm() {
	const token = useSearchParams().get("token");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [show, setShow] = useState({ password: false, confirm: false });
	const [touched, setTouched] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);

	const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
	const mismatch = confirm.length > 0 && confirm !== password;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setTouched(true);
		setError("");
		if (!token || password.length < MIN_PASSWORD || password !== confirm) return;
		setLoading(true);
		try {
			const res = await fetch(`${API_BASE_URL}/users/reset-password-confirm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message || "We couldn't reset your password. The link may have expired.");
			setDone(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	if (done) {
		return (
			<div className="text-center">
				<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
					<CheckCircle2 className="h-7 w-7 text-emerald-600" />
				</span>
				<h2 className="mt-5 text-2xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
					Password updated
				</h2>
				<p className="mt-2 text-slate-600">You can now sign in with your new password.</p>
				<Link href="/auth/login" className="mt-8 block">
					<Button size="lg" fullWidth>
						Sign in
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<>
			<h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
				Choose a new password
			</h2>
			<p className="mt-2 text-slate-600">Use at least {MIN_PASSWORD} characters.</p>

			{!token && (
				<Alert type="error" className="mt-6">
					This reset link is missing its code. Please use the link from your email, or{" "}
					<Link href="/auth/forgot-password" className="font-semibold underline">
						request a new one
					</Link>
					.
				</Alert>
			)}
			{error && (
				<Alert type="error" className="mt-6">
					{error}
				</Alert>
			)}

			<form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
				<Input
					label="New password"
					type={show.password ? "text" : "password"}
					autoComplete="new-password"
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					icon={<Lock />}
					error={(touched || tooShort) && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : undefined}
					trailing={<RevealButton shown={show.password} onToggle={() => setShow((s) => ({ ...s, password: !s.password }))} />}
				/>
				<Input
					label="Confirm new password"
					type={show.confirm ? "text" : "password"}
					autoComplete="new-password"
					required
					value={confirm}
					onChange={(e) => setConfirm(e.target.value)}
					icon={<Lock />}
					error={(touched && confirm !== password) || mismatch ? "The passwords don't match." : undefined}
					trailing={<RevealButton shown={show.confirm} onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} />}
				/>
				<Button type="submit" size="lg" fullWidth loading={loading} disabled={!token}>
					{loading ? "Saving…" : "Save new password"}
				</Button>
			</form>
		</>
	);
}

export default function ResetPasswordPage() {
	return (
		<AuthShell>
			<Suspense
				fallback={
					<div className="space-y-4" aria-label="Loading">
						<Skeleton className="h-9 w-2/3" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				}
			>
				<ResetPasswordForm />
			</Suspense>
		</AuthShell>
	);
}
