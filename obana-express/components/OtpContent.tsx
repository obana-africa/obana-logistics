"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Alert } from "@/components/ui";
import { Lock, Mail, Package, CheckCircle, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function OtpPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { verifyOtp, error, clearError, user } = useAuth();
	const [loading, setLoading] = useState(false);
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [timer, setTimer] = useState(300); // 5 minutes
	const [canResend, setCanResend] = useState(false);

	const requestId = searchParams.get("request_id");
	const email = searchParams.get("email");

	useEffect(() => {
		if (timer > 0) {
			const interval = setInterval(() => setTimer(timer - 1), 1000);
			return () => clearInterval(interval);
		} else {
			setCanResend(true);
		}
	}, [timer]);

	const handleOtpChange = (index: number, value: string) => {
		if (!/^\d?$/.test(value)) return;

		const newOtp = [...otp];
		newOtp[index] = value;
		setOtp(newOtp);

		// Auto focus next input
		if (value && index < 3) {
			const nextInput = document.getElementById(`otp-${index + 1}`);
			nextInput?.focus();
		}
	};

	const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !otp[index] && index > 0) {
			const prevInput = document.getElementById(`otp-${index - 1}`);
			prevInput?.focus();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pastedData = e.clipboardData.getData("text").slice(0, 4);
		if (!/^\d+$/.test(pastedData)) return;

		const newOtp = pastedData.split("");
		setOtp([...newOtp, ...Array(4 - newOtp.length).fill("")]);

		// Focus last filled input
		const lastIndex = Math.min(pastedData.length - 1, 3);
		const lastInput = document.getElementById(`otp-${lastIndex}`);
		lastInput?.focus();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const otpString = otp.join("");

		if (otpString.length !== 4) return;

		clearError();
		setLoading(true);

		try {
			const response = await verifyOtp(requestId || "", otpString);

			let userRole = response?.data?.user?.role || response?.data?.role;

			if (!userRole && user?.role) {
				userRole = user.role;
			}

			if (userRole) {
				const roleBasedRoutes: Record<string, string> = {
					customer: "/dashboard/customer",
					driver: "/dashboard/driver",
					admin: "/dashboard/admin",
					agent: "/dashboard/agent",
				};

				const dashboardPath =
					roleBasedRoutes[userRole.toLowerCase()] || "/dashboard";

				router.replace(dashboardPath);
			} else {
				console.warn("No role found after successful OTP verification");
				router.replace("/dashboard");
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			console.error("OTP verification failed:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleResend = () => {
		if (!canResend) return;
		// Add your resend logic here
		setTimer(300);
		setCanResend(false);
		setOtp(["", "", "", ""]);
	};

	const minutes = Math.floor(timer / 60);
	const seconds = timer % 60;
	const isComplete = otp.every((digit) => digit !== "");

	return (
		<div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
			{/* Animated background elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
				<div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
				<Package className="absolute top-1/4 right-1/4 w-16 h-16 text-white/5 animate-float" />
				<Mail className="absolute bottom-1/3 left-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
			</div>

			<div className="w-full max-w-md relative z-10">
				<Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
					<div className="text-center mb-8">
						<Link
							href="/"
							className="flex items-center justify-center bg-[#f4f4f4] rounded-lg "
						>
							<Image
								src="/logo.svg"
								alt="Obana Logistics Logo"
								width={100}
								height={100}
								className="ml-2"
							/>
						</Link>
						<p className="text-[#1B3E5D] text-lg font-medium">
							Logistics Made Simple
						</p>
					</div>

					<div className="text-center mb-8">
						<div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-blue-100 to-blue-200 rounded-2xl mb-4">
							<Lock className="w-8 h-8 text-blue-600" />
						</div>
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Verify Your Email
						</h2>
						<p className="text-gray-600">
							We sent a 4-digit code to
							{email && (
								<span className="block font-semibold text-gray-800 mt-1">
									{email}
								</span>
							)}
						</p>
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

					<form onSubmit={handleSubmit} className="space-y-6">
						{/* OTP Input */}
						<div className="flex gap-3 justify-center" onPaste={handlePaste}>
							{otp.map((digit, index) => (
								<input
									key={index}
									id={`otp-${index}`}
									type="text"
									inputMode="numeric"
									maxLength={1}
									value={digit}
									onChange={(e) => handleOtpChange(index, e.target.value)}
									onKeyDown={(e) => handleKeyDown(index, e)}
									className={`w-14 h-14 border-2 rounded-xl text-center text-2xl font-bold transition-all
                    ${digit ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-300 bg-white text-gray-900"}
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none
                    hover:border-blue-400`}
									aria-label={`OTP digit ${index + 1}`}
								/>
							))}
						</div>

						{/* Timer */}
						<div className="text-center">
							<div
								className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg ${
									timer < 60
										? "bg-orange-50 text-orange-600"
										: "bg-gray-50 text-gray-600"
								}`}
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span className="text-sm font-semibold">
									{timer > 0
										? `Code expires in ${minutes}:${seconds.toString().padStart(2, "0")}`
										: "Code expired"}
								</span>
							</div>
						</div>

						{/* Submit Button */}
						<Button
							type="submit"
							loading={loading}
							fullWidth
							variant="primary"
							disabled={!isComplete}
							className="h-12 text-base font-semibold bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? (
								<span className="flex items-center justify-center space-x-2">
									<RefreshCw className="w-5 h-5 animate-spin" />
									<span>Verifying...</span>
								</span>
							) : (
								<span className="flex items-center justify-center space-x-2">
									<CheckCircle className="w-5 h-5" />
									<span>Verify Code</span>
								</span>
							)}
						</Button>
					</form>

					{/* Resend Section */}
					<div className="mt-8 pt-6 border-t border-gray-200 text-center">
						<p className="text-gray-600 text-sm mb-3">
							Didn't receive the code?
						</p>
						<button
							onClick={handleResend}
							disabled={!canResend}
							className={`inline-flex items-center space-x-2 font-semibold text-sm px-4 py-2 rounded-lg transition-all
                ${
									canResend
										? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
										: "text-gray-400 cursor-not-allowed"
								}`}
						>
							<RefreshCw
								className={`w-4 h-4 ${canResend ? "" : "opacity-50"}`}
							/>
							<span>
								{canResend
									? "Resend Code"
									: `Resend in ${minutes}:${seconds.toString().padStart(2, "0")}`}
							</span>
						</button>
					</div>
				</Card>

				{/* Help Text */}
				<div className="mt-6 text-center">
					<p className="text-blue-200 text-sm">
						Having trouble? Check your spam folder or{" "}
						<a href="#" className="text-white font-semibold hover:underline">
							contact support
						</a>
					</p>
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
