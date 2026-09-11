"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { dashboardFor } from "@/lib/site";

export default function LoginPage() {
	const router = useRouter();
	const { login, error, clearError } = useAuth();
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [form, setForm] = useState({ userIdentification: "", password: "", rememberMe: false });

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();
		setLoading(true);
		try {
			const response = await login(form.userIdentification.trim(), form.password, form.rememberMe);
			router.replace(dashboardFor(response?.data?.user));
		} catch {
			// The error message is shown from the auth context.
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthShell>
			<h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
				Welcome back
			</h2>
			<p className="mt-2 text-slate-600">Sign in to manage your shipments.</p>

			{error && (
				<Alert type="error" className="mt-6">
					{error}
				</Alert>
			)}

			<form onSubmit={handleSubmit} className="mt-8 space-y-5">
				<Input
					label="Email or phone number"
					type="text"
					inputMode="email"
					autoComplete="username"
					placeholder="you@company.com"
					required
					value={form.userIdentification}
					onChange={(e) => setForm({ ...form, userIdentification: e.target.value })}
					icon={<Mail />}
				/>

				<Input
					label="Password"
					type={showPassword ? "text" : "password"}
					autoComplete="current-password"
					placeholder="Your password"
					required
					value={form.password}
					onChange={(e) => setForm({ ...form, password: e.target.value })}
					icon={<Lock />}
					trailing={
						<button
							type="button"
							onClick={() => setShowPassword((s) => !s)}
							aria-label={showPassword ? "Hide password" : "Show password"}
							className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
						>
							{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
						</button>
					}
				/>

				<div className="flex items-center justify-between gap-4">
					<Checkbox label="Keep me signed in" checked={form.rememberMe} onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })} />
					<Link href="/auth/forgot-password" className="text-sm font-semibold text-[#1B3B5F] hover:underline">
						Forgot password?
					</Link>
				</div>

				<Button type="submit" size="lg" fullWidth loading={loading}>
					{loading ? "Signing in…" : "Sign in"}
				</Button>
			</form>

			<p className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
				New to Obana?{" "}
				<Link href="/auth/signup" className="font-semibold text-[#1B3B5F] hover:underline">
					Create an account
				</Link>
			</p>
		</AuthShell>
	);
}
