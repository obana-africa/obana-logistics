"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { Button, Input, Card, Alert } from "@/components/ui";
import { Mail, Lock, Package, Truck } from "lucide-react";

export default function LoginPage() {
	const router = useRouter();
	const { login, error, clearError } = useAuth();
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		userIdentification: "",
		password: "",
		rememberMe: false,
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();
		setLoading(true);

		try {
			const response = await login(
				formData.userIdentification,
				formData.password,
				formData.rememberMe
			);
			if (response?.data?.request_id) {
				router.push(`/auth/otp?request_id=${response.data.request_id}`);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
			{/* Animated background elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
				<div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
				<Package className="absolute top-1/4 right-1/4 w-16 h-16 text-white/5 animate-float" />
				<Truck className="absolute bottom-1/3 left-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
			</div>

			<div className="w-full max-w-md relative z-10">
				{/* Logo and Brand Section */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-2xl mb-4 transform hover:scale-105 transition-transform">
						<Package className="w-10 h-10 text-white" />
					</div>
					<h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
						Obana
					</h1>
					<p className="text-blue-200 text-lg font-medium">
						Logistics Made Simple
					</p>
				</div>

				{/* Login Card */}
				<Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
					<div className="mb-6">
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Welcome Back
						</h2>
						<p className="text-gray-600">Sign in to access your dashboard</p>
					</div>

					{error && (
						<Alert
							type="error"
							className="mb-6 cursor-pointer bg-red-50 border-red-200"
							onClick={clearError}
						>
							{error}
						</Alert>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						<Input
							label="Email or Phone Number"
							type="text"
							placeholder="you@example.com or +234..."
							required
							value={formData.userIdentification}
							onChange={(e) =>
								setFormData({ ...formData, userIdentification: e.target.value })
							}
							icon={<Mail className="w-5 h-5 text-gray-400" />}
						/>

						<Input
							label="Password"
							type="password"
							placeholder="Enter your password"
							required
							value={formData.password}
							onChange={(e) =>
								setFormData({ ...formData, password: e.target.value })
							}
							icon={<Lock className="w-5 h-5 text-gray-400" />}
						/>

						<div className="flex items-center justify-between">
							<div className="flex items-center">
								<input
									type="checkbox"
									id="remember"
									checked={formData.rememberMe}
									onChange={(e) =>
										setFormData({ ...formData, rememberMe: e.target.checked })
									}
									className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
								/>
								<label
									htmlFor="remember"
									className="ml-2 text-sm text-gray-700 font-medium"
								>
									Remember me
								</label>
							</div>
							<a
								href="#"
								className="text-sm text-[#1B3E5D] hover:text-blue-700 font-semibold hover:underline"
							>
								Forgot password?
							</a>
						</div>

						<Button
							type="submit"
							loading={loading}
							fullWidth
							variant="primary"
							className="h-12 text-base font-semibold bg-[#1B3E5D] shadow-lg cursor-pointer"
						>
							Sign In
						</Button>
					</form>

					<div className="mt-8 pt-6 border-t border-gray-200 text-center">
						<p className="text-gray-600">
							Don't have an account?{" "}
							<a
								href="/auth/signup"
								className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
							>
								Create Account
							</a>
						</p>
					</div>
				</Card>

				{/* Trust Indicators */}
				<div className="mt-8 text-center">
					<p className="text-blue-200 text-sm mb-3">
						Trusted by businesses across Nigeria
					</p>
					<div className="flex items-center justify-center space-x-6 text-white/60">
						<div className="flex items-center space-x-2">
							<Package className="w-4 h-4" />
							<span className="text-xs">10k+ Deliveries</span>
						</div>
						<div className="flex items-center space-x-2">
							<Truck className="w-4 h-4" />
							<span className="text-xs">500+ Drivers</span>
						</div>
					</div>
				</div>
			</div>

			<style jsx>{`
				@keyframes float {
					0%,
					100% {
						transform: translateY(0px);
					}
					50% {
						transform: translateY(-20px);
					}
				}
				@keyframes float-delayed {
					0%,
					100% {
						transform: translateY(0px);
					}
					50% {
						transform: translateY(-15px);
					}
				}
				.animate-float {
					animation: float 6s ease-in-out infinite;
				}
				.animate-float-delayed {
					animation: float-delayed 8s ease-in-out infinite;
				}
			`}</style>
		</div>
	);
}
