"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import {
	Send,
	CheckCircle,
	MessageSquare,
} from "lucide-react";

export default function ContactForm() {
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phone: "",
		subject: "",
		message: "",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1500));

		setIsSubmitting(false);
		setIsSubmitted(true);

		// Reset after 3 seconds
		setTimeout(() => {
			setIsSubmitted(false);
			setFormData({
				name: "",
				email: "",
				phone: "",
				subject: "",
				message: "",
			});
		}, 3000);
	};

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	return (
		<section className="relative bg-[url('/images/hero-1.webp')] bg-cover bg-center top-30">
			<div className="max-w-7xl mx-auto px-6">
				{/* Main Contact Form Card */}
				<div className="relative z-10 transform translate-y-20">
					<div className="bg-[#1B3E5D]  rounded-3xl shadow-2xl overflow-hidden">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
							{/* Left Side - Info */}
							<div className="p-12 text-white relative overflow-hidden">
								<div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
								<div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl" />

								<div className="relative">
									<MessageSquare className="w-12 h-12 mb-6 text-amber-300" />
									<h2 className="text-4xl font-bold mb-4">
										Let&apos;s start a conversation
									</h2>
									<p className="text-blue-100 mb-8 leading-relaxed">
										Have a question about our services? Want to discuss a
										partnership? Or just want to say hi? We&apos;d love to hear from
										you.
									</p>

									<div className="space-y-4">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
												<CheckCircle className="w-5 h-5 text-white" />
											</div>
											<span className="text-blue-100">Quick response time</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
												<CheckCircle className="w-5 h-5 text-white" />
											</div>
											<span className="text-blue-100">Expert support team</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
												<CheckCircle className="w-5 h-5 text-white" />
											</div>
											<span className="text-blue-100">Tailored solutions</span>
										</div>
									</div>
								</div>
							</div>

							{/* Right Side - Form */}
							<div className="bg-white p-12">
								{isSubmitted ? (
									<div className="flex flex-col items-center justify-center h-full text-center py-12">
										<div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-scale-in">
											<CheckCircle className="w-10 h-10 text-green-600" />
										</div>
										<h3 className="text-2xl font-bold text-slate-900 mb-2">
											Message Sent!
										</h3>
										<p className="text-slate-600">
											We&apos;ll get back to you within 24 hours.
										</p>
									</div>
								) : (
									<form onSubmit={handleSubmit} className="space-y-6">
										<div>
											<h3 className="text-2xl font-bold text-slate-900 mb-2">
												Send us a message
											</h3>
											<p className="text-slate-600 text-sm">
												Fill out the form below and we&apos;ll be in touch soon
											</p>
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
											<div>
												<label className="block text-sm font-medium text-slate-700 mb-2">
													Full Name *
												</label>
												<input
													type="text"
													name="name"
													value={formData.name}
													onChange={handleChange}
													required
													className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
													placeholder="John Doe"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-slate-700 mb-2">
													Email Address *
												</label>
												<input
													type="email"
													name="email"
													value={formData.email}
													onChange={handleChange}
													required
													className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
													placeholder="john@example.com"
												/>
											</div>
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
											<div>
												<label className="block text-sm font-medium text-slate-700 mb-2">
													Phone Number
												</label>
												<input
													type="tel"
													name="phone"
													value={formData.phone}
													onChange={handleChange}
													className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
													placeholder="+234 800 000 0000"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-slate-700 mb-2">
													Subject *
												</label>
												<input
													type="text"
													name="subject"
													value={formData.subject}
													onChange={handleChange}
													required
													className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
													placeholder="How can we help?"
												/>
											</div>
										</div>

										<div>
											<label className="block text-sm font-medium text-slate-700 mb-2">
												Message *
											</label>
											<textarea
												name="message"
												value={formData.message}
												onChange={handleChange}
												required
												rows={4}
												className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
												placeholder="Tell us more about your inquiry..."
											/>
										</div>

										<Button
											type="submit"
											fullWidth
											disabled={isSubmitting}
											className="w-fullbg-[#1B3E5D]  text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{isSubmitting ? (
												<>
													<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
													Sending...
												</>
											) : (
												<>
													<Send className="w-5 h-5 mr-2" />
													Send Message
												</>
											)}
										</Button>

										<p className="text-xs text-slate-500 text-center">
											By submitting this form, you agree to our privacy policy
											and terms of service.
										</p>
									</form>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
