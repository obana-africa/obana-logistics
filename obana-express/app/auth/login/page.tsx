"use client";

import React, { useState } from "react";
import { Button, Input, Card, Alert } from "@/components/ui";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/users/reset-password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ user_identification: email })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Failed to process request');
			}

			setSuccess(true);
		} catch (err: any) {
			setError(err.message || "An error occurred. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
					<div className="mb-6 text-center">
						<Link href="/" className="inline-block bg-[#f4f4f4] rounded-lg mb-4">
							<Image
								src="/logo.svg"
								alt="Obana Logistics Logo"
								width={100}
								height={100}
								className="ml-2"
							/>
						</Link>
						<h2 className="text-2xl font-bold text-gray-900">
							Reset Password
						</h2>
						<p className="text-gray-600 mt-2">
							Enter your email or phone to receive reset instructions
						</p>
					</div>

					{success ? (
						<div className="text-center py-6">
							<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
								<CheckCircle className="w-8 h-8 text-green-600" />
							</div>
							<h3 className="text-lg font-semibold text-gray-900 mb-2">Request Sent</h3>
							<p className="text-gray-600 mb-6">
								If an account exists for <strong>{email}</strong>, you will receive instructions to reset your password shortly.
							</p>
							<Link href="/auth/login">
								<Button fullWidth variant="primary">
									Return to Login
								</Button>
							</Link>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-6">
							{error && (
								<Alert type="error" onClick={() => setError("")}>
									{error}
								</Alert>
							)}

							<Input
								label="Email or Phone Number"
								type="text"
								placeholder="Enter your email or phone"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								icon={<Mail className="w-5 h-5 text-gray-400" />}
							/>

							<Button
								type="submit"
								loading={loading}
								fullWidth
								variant="primary"
								className="h-12 font-semibold bg-[#1B3E5D]"
							>
								Send Reset Link
							</Button>

							<div className="text-center">
								<Link
									href="/auth/login"
									className="inline-flex items-center text-sm text-gray-600 hover:text-[#1B3E5D] font-medium transition-colors"
								>
									<ArrowLeft className="w-4 h-4 mr-2" />
									Back to Login
								</Link>
							</div>
						</form>
					)}
				</Card>
			</div>
		</div>
	);
}