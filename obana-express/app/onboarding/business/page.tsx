"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AlertCircle, CheckCircle, Copy, Eye, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function BusinessOnboardingPage() {
	const [step, setStep] = useState<"form" | "success">("form");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);
	const [copied, setCopied] = useState(false);

	const [formData, setFormData] = useState({
		name: "",
		slug: "",
		base_url: "",
		description: "",
	});

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			// registe response interface
         
			const response = await apiClient.registerTenant(
				formData.name,
				formData.slug,
				formData.base_url,
				formData.description
			);

			if (response?.data?.api_key) {
				setApiKey(response.data.api_key);
				setStep("success");
			} else {
				setError("Failed to generate API key");
			}
		} catch (err: any) {
			setError(err.response?.data?.message || "Registration failed");
		} finally {
			setLoading(false);
		}
	};

	const copyToClipboard = () => {
		navigator.clipboard.writeText(apiKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 pt-20 pb-12">
			<div className="max-w-2xl mx-auto px-4">
				{/* Header */}
				<div className="mb-8">
					<Link href="/" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
						← Back to Home
					</Link>
					<h1 className="text-4xl font-bold text-gray-900 mb-2">
						Integrate Obana Logistics
					</h1>
					<p className="text-lg text-gray-600">
						Register your business and get instant API access to manage shipments programmatically
					</p>
				</div>

				{step === "form" ? (
					// Registration Form
					<div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
						<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
							<div className="flex gap-3">
								<AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
								<div>
									<h3 className="font-semibold text-blue-900 mb-1">
										What You'll Get
									</h3>
									<ul className="text-sm text-blue-800 space-y-1">
										<li>• Unique API Key for your business</li>
										<li>• Full access to shipment creation & tracking</li>
										<li>• Real-time webhooks for shipment updates</li>
										<li>• Comprehensive API documentation</li>
									</ul>
								</div>
							</div>
						</div>

						<form onSubmit={handleSubmit} className="space-y-5">
							{error && (
								<div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
									{error}
								</div>
							)}

							<div>
								<label className="block text-sm font-semibold text-gray-900 mb-2">
									Business Name *
								</label>
								<input
									type="text"
									name="name"
									value={formData.name}
									onChange={handleInputChange}
									placeholder="e.g., Zoho CRM, Shopify Store"
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
									required
								/>
								<p className="text-xs text-gray-500 mt-1">
									Your business or application name
								</p>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-900 mb-2">
									Slug (URL-friendly identifier) *
								</label>
								<input
									type="text"
									name="slug"
									value={formData.slug}
									onChange={handleInputChange}
									placeholder="e.g., zohocrm"
									pattern="^[a-z0-9-]+$"
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
									required
								/>
								<p className="text-xs text-gray-500 mt-1">
									Lowercase letters, numbers, and hyphens only
								</p>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-900 mb-2">
									Base URL *
								</label>
								<input
									type="url"
									name="base_url"
									value={formData.base_url}
									onChange={handleInputChange}
									placeholder="e.g., www.zohoapis.com/crm/v2"
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
									required
								/>
								<p className="text-xs text-gray-500 mt-1">
									Your application's base API URL
								</p>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-900 mb-2">
									Description
								</label>
								<textarea
									name="description"
									value={formData.description}
									onChange={handleInputChange}
									placeholder="Brief description of your business or integration..."
									rows={4}
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
								/>
							</div>

							<div className="pt-4">
								<Button
									type="submit"
									disabled={loading}
									className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
								>
									{loading ? (
										<>
											<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
											Registering...
										</>
									) : (
										"Register & Get API Key"
									)}
								</Button>
							</div>
						</form>

						<p className="text-sm text-gray-600 text-center mt-6">
							Already registered?{" "}
							<Link href="/docs" className="text-blue-600 hover:underline font-medium">
								View API Documentation
							</Link>
						</p>
					</div>
				) : (
					// Success State
					<div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
						<div className="text-center mb-8">
							<div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
								<CheckCircle className="w-8 h-8 text-green-600" />
							</div>
							<h2 className="text-3xl font-bold text-gray-900 mb-2">
								Welcome Aboard! 🎉
							</h2>
							<p className="text-gray-600">
								Your business is now registered. Here's your API Key:
							</p>
						</div>

						{/* API Key Display */}
						<div className="bg-slate-900 rounded-lg p-4 mb-6 font-mono">
							<div className="flex items-center justify-between">
								<span className="text-slate-400 text-sm">API Key:</span>
								<button
									onClick={() => setShowApiKey(!showApiKey)}
									className="text-slate-400 hover:text-slate-300"
								>
									{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								</button>
							</div>
							<div className="flex items-center gap-2 mt-2">
								<code className="text-green-400 flex-1 break-all">
									{showApiKey ? apiKey : "••••••••••••••••••••••"}
								</code>
								<button
									onClick={copyToClipboard}
									className={`p-2 rounded transition-colors ${
										copied
											? "bg-green-600 text-white"
											: "bg-slate-700 hover:bg-slate-600 text-slate-300"
									}`}
									title="Copy to clipboard"
								>
									<Copy className="w-4 h-4" />
								</button>
							</div>
						</div>

						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
							<p className="text-sm text-yellow-800">
								<strong>⚠️ Note:</strong> Save your API key securely.
								Anyone with this key can create shipments on your behalf. Keep it secret.
							</p>
						</div>

						<div className="space-y-4">
							<h3 className="font-semibold text-gray-900">Next Steps:</h3>
							<ol className="space-y-3">
								<li className="flex gap-3">
									<span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
										1
									</span>
									<div>
										<p className="font-medium text-gray-900">
											Read the API Documentation
										</p>
										<p className="text-sm text-gray-600">
											Learn how to authenticate and use the Shipments API
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
										2
									</span>
									<div>
										<p className="font-medium text-gray-900">
											Integrate with Your Application
										</p>
										<p className="text-sm text-gray-600">
											Use your API key to authenticate requests from your backend
										</p>
									</div>
								</li>
								<li className="flex gap-3">
									<span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
										3
									</span>
									<div>
										<p className="font-medium text-gray-900">
											Start Creating Shipments
										</p>
										<p className="text-sm text-gray-600">
											Use the API endpoints to create and track shipments
										</p>
									</div>
								</li>
							</ol>
						</div>

						<div className="flex gap-3 mt-8 pt-8 border-t border-slate-200">
							<Link href="/docs" className="flex-1">
								<Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
									View API Docs
								</Button>
							</Link>
							<Link href="/" className="flex-1">
								<Button variant="ghost" className="w-full">
									Back to Home
								</Button>
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
