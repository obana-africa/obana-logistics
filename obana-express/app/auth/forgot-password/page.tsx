"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input } from "@/components/ui";
import { API_BASE_URL } from "@/lib/site";

export default function ForgotPasswordPage() {
	const [identifier, setIdentifier] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const res = await fetch(`${API_BASE_URL}/users/reset-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_identification: identifier.trim() }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message || "We couldn't send the reset link. Please try again.");
			setSent(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthShell>
			{sent ? (
				<div className="text-center">
					<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
						<CheckCircle2 className="h-7 w-7 text-emerald-600" />
					</span>
					<h2 className="mt-5 text-2xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
						Check your inbox
					</h2>
					<p className="mt-2 text-slate-600">
						If an account exists for <strong className="text-slate-900">{identifier}</strong>, we&apos;ve sent a link to reset your password.
					</p>
					<Link href="/auth/login" className="mt-8 block">
						<Button size="lg" fullWidth>
							Back to sign in
						</Button>
					</Link>
				</div>
			) : (
				<>
					<h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
						Reset your password
					</h2>
					<p className="mt-2 text-slate-600">Enter the email or phone number on your account and we&apos;ll send you a reset link.</p>

					{error && (
						<Alert type="error" className="mt-6">
							{error}
						</Alert>
					)}

					<form onSubmit={handleSubmit} className="mt-8 space-y-5">
						<Input
							label="Email or phone number"
							autoComplete="username"
							placeholder="you@company.com"
							required
							value={identifier}
							onChange={(e) => setIdentifier(e.target.value)}
							icon={<Mail />}
						/>
						<Button type="submit" size="lg" fullWidth loading={loading}>
							{loading ? "Sending…" : "Send reset link"}
						</Button>
					</form>

					<Link href="/auth/login" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1B3B5F]">
						<ArrowLeft className="h-4 w-4" /> Back to sign in
					</Link>
				</>
			)}
		</AuthShell>
	);
}
