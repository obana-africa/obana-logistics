"use client"
import React, { useState, Suspense } from "react";
import { Button, Input, Card, Alert } from "@/components/ui";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!token) {
            setError("Invalid or missing reset token. Please request a new link.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/users/reset-password-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to reset password');
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Reset Successful</h3>
                <p className="text-gray-600 mb-6">
                    Your password has been updated. You can now log in with your new password.
                </p>
                <Link href="/auth/login">
                    <Button fullWidth variant="primary">
                        Go to Login
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {!token && (
                 <Alert type="error">Missing reset token. Please check your email link.</Alert>
            )}
            
            {error && (
                <Alert type="error" onClick={() => setError("")}>
                    {error}
                </Alert>
            )}

            <div className="relative">
                <Input
                    label="New Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock className="w-5 h-5 text-gray-400" />}
                    className="pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-10.5 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>

            <div className="relative">
                <Input
                    label="Confirm Password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    icon={<Lock className="w-5 h-5 text-gray-400" />}
                    className="pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-10.5 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>

            <Button type="submit" loading={loading} fullWidth variant="primary" disabled={!token}>
                Set New Password
            </Button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
                    <div className="mb-6 text-center">
                        <Link href="/" className="inline-block bg-[#f4f4f4] rounded-lg mb-4">
                            <Image src="/logo.svg" alt="Obana Logistics Logo" width={100} height={100} className="ml-2" />
                        </Link>
                        <h2 className="text-2xl font-bold text-gray-900">Create New Password</h2>
                    </div>
                    <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </Card>
            </div>
        </div>
    );
}