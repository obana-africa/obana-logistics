"use client";

import React from "react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";

export default function ContactFormSection() {
	return (
		<section className="relative py-12 overflow-hidden">
			<div
				className="absolute inset-0 bg-cover bg-center bg-fixed"
				style={{
					backgroundImage: "url('/images/hero-2.webp')",
				}}
			/>

			{/* Dark Overlay for better text contrast */}
			<div className="absolute inset-0 bg-[#1B3E5D]/70" />

			{/* Animated gradient overlay */}
			<div className="absolute inset-0">
				<div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
				<div
					className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
					style={{ animationDelay: "1s" }}
				/>
			</div>

			<div className="max-w-7xl mx-auto px-6 relative z-10">
				<div className="text-center mb-16">
					<h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
						Get in Touch
					</h2>
					<p className="text-xl text-blue-100 max-w-2xl mx-auto">
						Have questions? We&apos;re here to help you 24/7
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<div className="group relative bg-white/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-2 border border-white/20">
						<div className="absolute inset-0 bg-linear-to-br from-blue-500/5 to-blue-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

						<div className="relative">
							<div className="w-16 h-16 bg-[#1B3E5D]  rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
								<Mail className="w-8 h-8 text-white" />
							</div>

							{/* Content */}
							<h3 className="text-2xl font-bold text-slate-900 mb-3">
								Email Us
							</h3>
							<p className="text-slate-600 mb-4 leading-relaxed">
								Our team responds within 24 hours
							</p>

							{/* Link */}
							<a
								href="mailto:support@obanalogistics.com"
								className="inline-flex items-center gap-2 text-[#1B3E5D]  font-semibold hover:text-blue-700 hover:gap-3 transition-all group/link"
							>
								support@obanalogistics.com
								<ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
							</a>
						</div>
					</div>

					{/* Phone Card */}
					<div className="group relative bg-white/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 hover:-translate-y-2 border border-white/20">
						<div className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-amber-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

						<div className="relative">
							<div className="w-16 h-16 bg-linear-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
								<Phone className="w-8 h-8 text-white" />
							</div>

							{/* Content */}
							<h3 className="text-2xl font-bold text-slate-900 mb-3">
								Call Us
							</h3>
							<p className="text-slate-600 mb-4 leading-relaxed">
								Monday to Friday, 8AM - 6PM WAT
							</p>

							{/* Link */}
							<a
								href="tel:+2341234567890"
								className="inline-flex items-center gap-2 text-amber-600 font-semibold hover:text-amber-700 hover:gap-3 transition-all group/link"
							>
								+234 123 456 7890
								<ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
							</a>
						</div>
					</div>

					{/* Location Card */}
					<div className="group relative bg-white/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-2 border border-white/20">
						{/* Gradient background on hover */}
						<div className="absolute inset-0 bg-linear-to-br from-purple-500/5 to-purple-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

						<div className="relative">
							{/* Icon */}
							<div className="w-16 h-16 bg-[#1B3E5D]  rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
								<MapPin className="w-8 h-8 text-white" />
							</div>

							{/* Content */}
							<h3 className="text-2xl font-bold text-slate-900 mb-3">
								Visit Us
							</h3>
							<p className="text-slate-600 mb-4 leading-relaxed">
								Come say hello at our office
							</p>

							{/* Link */}
							<a
								href="https://www.google.com/maps/place/77+Opebi+Rd,+Opebi,+Ikeja+101233,+Lagos/@6.5879113,3.3578362,17z/data=!3m1!4b1!4m6!3m5!1s0x103b935d17f4b3ef:0x12927a1d5e1954cb!8m2!3d6.587906!4d3.3627071!16s%2Fg%2F11vpywyrpj?entry=ttu&g_ep=EgoyMDI2MDIwNC4wIKXMDSoASAFQAw%3D%3D"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 text-[#1B3E5D] hover:text-purple-700 hover:gap-3 transition-all group/link"
							>
								77 Opebi Road, Ikeja, Lagos
								<ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
							</a>
						</div>
					</div>
				</div>

				{/* Additional CTA */}
				<div className="mt-16 text-center">
					<p className="text-white/90 text-lg mb-4">
						Ready to ship with Obana?
					</p>
					<a
						href="/auth/signup"
						className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-bold px-8 py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105"
					>
						Get Started Free
						<ArrowRight className="w-5 h-5" />
					</a>
				</div>
			</div>
		</section>
	);
}
