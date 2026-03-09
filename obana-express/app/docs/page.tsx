"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Code2, Copy, ChevronDown, ChevronRight } from "lucide-react";

export default function DocsPage() {
	const [expandedSection, setExpandedSection] = useState<string | null>("getting-started");
	const [copied, setCopied] = useState("");

	const copyCode = (text: string, id: string) => {
		navigator.clipboard.writeText(text);
		setCopied(id);
		setTimeout(() => setCopied(""), 2000);
	};

	const CodeBlock = ({ code, language = "bash", id }: { code: string; language?: string; id: string }) => (
		<div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 my-4">
			<div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
				<span className="text-xs text-slate-400 font-mono">{language}</span>
				<button
					onClick={() => copyCode(code, id)}
					className={`p-1.5 rounded transition-colors ${
						copied === id
							? "bg-green-600 text-white"
							: "bg-slate-700 hover:bg-slate-600 text-slate-300"
					}`}
				>
					<Copy className="w-4 h-4" />
				</button>
			</div>
			<pre className="p-4 overflow-x-auto">
				<code className="text-sm text-slate-100 font-mono">{code}</code>
			</pre>
		</div>
	);

	const Section = ({
		title,
		id,
		children,
	}: {
		title: string;
		id: string;
		children: React.ReactNode;
	}) => (
		<div className="border-b border-slate-200">
			<button
				onClick={() =>
					setExpandedSection(expandedSection === id ? null : id)
				}
				className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
			>
				<h2 className="text-xl font-bold text-gray-900">
					{title}
				</h2>
				{expandedSection === id ? (
					<ChevronDown className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
				) : (
					<ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
				)}
			</button>
			{expandedSection === id && (
				<div className="px-6 pb-6 bg-slate-50 border-t border-slate-200">
					{children}
				</div>
			)}
		</div>
	);

	const Endpoint = ({
		method,
		path,
		description,
	}: {
		method: string;
		path: string;
		description: string;
	}) => (
		<div className="my-3 p-3 bg-white border border-slate-200 rounded">
			<div className="flex items-center gap-3 mb-2">
				<span
					className={`px-2 py-1 rounded font-mono text-sm font-bold text-white ${
						method === "POST"
							? "bg-green-600"
							: method === "GET"
								? "bg-blue-600"
								: method === "PUT"
									? "bg-yellow-600"
									: "bg-red-600"
					}`}
				>
					{method}
				</span>
				<code className="font-mono text-sm text-gray-900">{path}</code>
			</div>
			<p className="text-sm text-gray-600">{description}</p>
		</div>
	);

	return (
		<div className="min-h-screen bg-white pt-20 pb-12">
			<div className="max-w-5xl mx-auto px-4">
				{/* Header */}
				<div className="mb-12">
					<Link
						href="/"
						className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
					>
						← Back to Home
					</Link>
					<h1 className="text-5xl font-bold text-gray-900 mb-4">
						API Documentation
					</h1>
					<p className="text-xl text-gray-600 max-w-3xl">
						Complete guide to integrating Obana Logistics with your application
					</p>
				</div>

				{/* Quick Links */}
				{/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
					<Link href="/onboarding/business">
						<Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
							Register Business
						</Button>
					</Link>
					<a href="#authentication">
						<Button variant="ghost" className="w-full">
							Authentication
						</Button>
					</a>
					<a href="#shipments">
						<Button variant="ghost" className="w-full">
							Shipments API
						</Button>
					</a>
					<a href="#errors">
						<Button variant="ghost" className="w-full">
							Error Handling
						</Button>
					</a>
				</div> */}

				{/* Main Content */}
				<div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
					{/* Getting Started */}
					<Section id="getting-started" title="1. Getting Started">
						<div className="space-y-4">
							<p className="text-gray-700">
								Obana Logistics provides a API's for managing shipments
								programmatically. Here's how to get started:
							</p>

							<div className="bg-blue-50 border border-blue-200 rounded p-4">
								<h3 className="font-semibold text-blue-900 mb-2">
									Prerequisites
								</h3>
								<ul className="text-sm text-blue-800 space-y-1">
									<li>✓ Register your business on our platform</li>
									<li>✓ Receive your unique API Key</li>
									<li>✓ Basic knowledge of REST APIs</li>
									<li>✓ HTTP client library (curl, Axios, requests, etc.)</li>
								</ul>
							</div>

							<h3 className="font-semibold text-gray-900 mt-6">
								Steps
							</h3>
							<ol className="space-y-2 text-gray-700">
								<li>
									<strong>1. Register:</strong> Go to the{" "}
									<Link href="/onboarding/business" className="text-blue-600 hover:underline">
										business onboarding page
									</Link>{" "}
									and register your application
								</li>
								<li>
									<strong>2. Get API Key:</strong> Copy your API key from the
									confirmation page
								</li>
								<li>
									<strong>3. Start Integrating:</strong> Use the endpoints below
									with your API key
								</li>
							</ol>
						</div>
					</Section>

					{/* Authentication */}
					<Section id="authentication" title="2. Authentication">
						<div className="space-y-4">
							<p className="text-gray-700">
								All API requests must include your API key in the{" "}
								<code className="bg-slate-100 px-2 py-1 rounded text-sm">
									Authoriation
								</code>{" "}
								header.
							</p>

							<CodeBlock
								code={`curl -X POST ${process.env.NEXT_PUBLIC_API_URL}/shipments \\
  -H "Authoriation: Bearer obana_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "pickup_address": {...} }'`}
								language="bash"
								id="auth-example"
							/>

							<div className="space-y-3">
								<h3 className="font-semibold text-gray-900">
									Node.js Example
								</h3>
								<CodeBlock
									code={`const axios = require('axios');

const apiKey = 'Bearer obana_your_api_key_here';
const client = axios.create({
  baseURL: ${process.env.NEXT_PUBLIC_API_URL},
  'Authorization': Bearer apiKey,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Use client for all requests
const response = await client.post('/shipments', { /* ... */ });`}
									language="javascript"
									id="node-example"
								/>
							</div>

							<div className="space-y-3">
								<h3 className="font-semibold text-gray-900">
									Python Example
								</h3>
								<CodeBlock
									code={`import requests

api_key = 'Bearer obana_your_api_key_here'
headers = {
    'Authoriation': api_key,
    'Content-Type': 'application/json'
}

response = requests.post(
    '${process.env.NEXT_PUBLIC_API_URL}/shipments',
    json={...},
    headers=headers
)`}
									language="python"
									id="python-example"
								/>
							</div>
						</div>
					</Section>

					{/* Base URL */}
					<Section id="base-url" title="3. Base URL">
						<div className="space-y-4">
							<p className="text-gray-700">
								All API endpoints are relative to:
							</p>
							<CodeBlock
								code={`${process.env.NEXT_PUBLIC_API_URL}`}
								id="base-url-example"
							/>
						</div>
					</Section>

					{/* Shipments API */}
					<Section id="shipments" title="4. Shipments API">
						<div className="space-y-6">
							<div>
								<h3 className="font-semibold text-gray-900 mb-3">
									Create Shipment
								</h3>
								<Endpoint
									method="POST"
									path="/shipments"
									description="Create a new shipment"
								/>

								<h4 className="font-semibold text-gray-900 mt-4 mb-2">
									Request Body
								</h4>
								<CodeBlock
									code={`{
  "pickup_address": {
    "line1": "123 Vendor Street",
    "line2": "Suite 100",
    "city": "Lagos",
    "state": "Lagos State",
    "country": "Nigeria",
    "phone": "+234 801 234 5678",
    "contact_name": "John Doe",
    "email": "vendor@example.com"
  },
  "delivery_address": {
    "line1": "456 Customer Ave",
    "city": "Ibadan",
    "state": "Oyo State",
    "country": "Nigeria",
    "phone": "+234 901 234 5678",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "customer@example.com"
  },
  "items": [
    {
      "name": "Product Name",
      "description": "Product details",
      "quantity": 2,
      "price": 5000,
      "weight": 1.5
    }
  ],
  "transport_mode": "road",
  "service_level": "Standard"
}`}
									language="json"
									id="create-shipment-request"
								/>

								<h4 className="font-semibold text-gray-900 mt-4 mb-2">
									Response
								</h4>
								<CodeBlock
									code={`{
  "success": true,
  "message": "Shipment created successfully",
  "data": {
    "shipment_id": 12345,
    "shipment_reference": "OBANA-20260303-ABC123",
    "tracking_url": "https://obana.africa/track/OBANA-20260303-ABC123",
    "carrier": "Obana Logistics",
    "status": "pending",
    "estimated_delivery": "2-3 days"
  }
}`}
									language="json"
									id="create-shipment-response"
								/>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-3">
									Get Shipment
								</h3>
								<Endpoint
									method="GET"
									path="/shipments/track/:shipment_reference"
									description="Get details of a specific shipment"
								/>

								<h4 className="font-semibold text-gray-900 mt-4 mb-2">
									Example Request
								</h4>
								<CodeBlock
									code={`curl -X GET ${process.env.NEXT_PUBLIC_API_URL}/shipments/track/OBANA-20260303-ABC123 \\
  -H "Authoriation: Bearer obana_your_api_key_here"`}
									language="bash"
									id="get-shipment-request"
								/>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-3">
									Cancel Shipment
								</h3>
								<Endpoint
									method="POST"
									path="/shipments/cancel/:shipment_id"
									description="Cancel a pending shipment"
								/>
							</div>
						</div>
					</Section>

					{/* Error Handling */}
					<Section id="errors" title="5. Error Handling">
						<div className="space-y-4">
							<p className="text-gray-700">
								The API returns standard HTTP status codes. Here are the common ones:
							</p>

							<div className="space-y-3">
								<div className="bg-white border border-slate-200 rounded p-3">
									<p className="font-semibold text-green-600">200 OK</p>
									<p className="text-sm text-gray-600">
										Request successful
									</p>
								</div>

								<div className="bg-white border border-slate-200 rounded p-3">
									<p className="font-semibold text-green-600">201 Created</p>
									<p className="text-sm text-gray-600">
										Resource created successfully
									</p>
								</div>

								<div className="bg-white border border-red-200 rounded p-3">
									<p className="font-semibold text-red-600">400 Bad Request</p>
									<p className="text-sm text-gray-600">
										Invalid request parameters
									</p>
								</div>

								<div className="bg-white border border-red-200 rounded p-3">
									<p className="font-semibold text-red-600">401 Unauthorized</p>
									<p className="text-sm text-gray-600">
										Missing or invalid API key
									</p>
								</div>

								<div className="bg-white border border-red-200 rounded p-3">
									<p className="font-semibold text-red-600">404 Not Found</p>
									<p className="text-sm text-gray-600">
										Resource not found
									</p>
								</div>

								<div className="bg-white border border-red-200 rounded p-3">
									<p className="font-semibold text-red-600">500 Server Error</p>
									<p className="text-sm text-gray-600">
										Server-side error. Try again later
									</p>
								</div>
							</div>

							<h3 className="font-semibold text-gray-900 mt-6">
								Error Response Format
							</h3>
							<CodeBlock
								code={`{
  "success": false,
  "message": "Invalid payload",
  "errors": [
    "pickup_address.city is required",
    "delivery_address.phone is required"
  ]
}`}
								language="json"
								id="error-response"
							/>
						</div>
					</Section>

					{/* Rate Limiting */}
					<Section id="rate-limiting" title="6. Rate Limiting">
						<div className="space-y-4">
							<p className="text-gray-700">
								Current rate limits (subject to change):
							</p>
							<ul className="space-y-2 text-gray-700">
								<li>
									<strong>Requests per minute:</strong> 100
								</li>
								<li>
									<strong>Requests per hour:</strong> 5,000
								</li>
								<li>
									<strong>Concurrent requests:</strong> 10
								</li>
							</ul>
							<p className="text-gray-600 text-sm mt-4">
								If you exceed these limits, you'll receive a 429 (Too Many
								Requests) response. Wait before retrying.
							</p>
						</div>
					</Section>

					{/* Support */}
					<Section id="support" title="7. Support">
						<div className="space-y-4">
							<p className="text-gray-700">
								Have questions or need help?
							</p>
							<ul className="space-y-2 text-gray-700">
								<li>
									<strong>Email:</strong>{" "}
									<a
										href="mailto:obana.africa@gmail.com"
										className="text-blue-600 hover:underline"
									>
										obana.africa@gmail.com
									</a>
								</li>
								<li>
									<strong>Documentation:</strong> This page
								</li>
								<li>
									<strong>Status:</strong> Check our{" "}
									<a
										href="https://status.obana.africa"
										className="text-blue-600 hover:underline"
										target="_blank"
										rel="noopener noreferrer"
									>
										status page
									</a>
								</li>
							</ul>
						</div>
					</Section>
				</div>

				{/* Footer CTA */}
				<div className="mt-12 text-center">
					<h2 className="text-2xl font-bold text-gray-900 mb-4">
						Ready to get started?
					</h2>
					<Link href="/onboarding/business">
						<Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold">
							Register Your Business
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
