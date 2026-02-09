"use client";

import React from "react";
import {
	Bell,
	MapPin,
	Package,
	Clock,
	Shield,
	Eye,
	CreditCard,
	TrendingUp,
} from "lucide-react";
import Image from "next/image";

const appFeatures = [
	{
		icon: Package,
		title: "Track packages in real-time",
		description:
			"Monitor all your shipments with live GPS tracking and instant notifications.",
		bgColor: "bg-blue-50",
		iconBg: "bg-blue-500",
		image: "/images/app-tracking.png",
		stats: [
			{ icon: MapPin, label: "Live Location" },
			{ icon: Bell, label: "Push Alerts" },
			{ icon: Clock, label: "ETA Updates" },
			{ icon: Shield, label: "Secure" },
		],
	},
	{
		icon: CreditCard,
		title: "Pay for deliveries seamlessly",
		description:
			"Instant payment processing with multiple payment options. Fast, secure, and convenient.",
		bgColor: "bg-pink-50",
		iconBg: "bg-pink-500",
		image: "/images/app-payment.png",
		partners: [
			{ name: "Paystack", logo: "/images/paystack.png" },
			{ name: "Salad", logo: "/images/salad.png" },
			{ name: "Stellas", logo: "/images/stellas.jpg" },
			{ name: "Carbon", logo: "/images/carbon.png" },
		],
	},
	{
		icon: TrendingUp,
		title: "Manage your shipping insights",
		description:
			"View detailed analytics, spending reports, and shipping history all in one place.",
		bgColor: "bg-slate-50",
		iconBg: "bg-slate-700",
		image: "/images/app-analytics.png",
		metric: {
			label: "Monthly Spending",
			value: "₦1,200,000",
			trend: "+12%",
		},
	},
];

export default function QuickActions() {
	return (
		<section className="pt-24 bg-[#ffffff] relative overflow-hidden">
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-20 right-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />
				<div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
			</div>

			<div className="max-w-7xl mx-auto px-6 relative">
				<div className="text-center mb-16">
					<h2 className="text-4xl md:text-5xl font-semibold text-slate-900 mb-4">
						Get the best experience with
						<span className="text-transparent bg-clip-text bg-[#1B3E5D] ml-2">
							Obana
						</span>
					</h2>
					<p className="text-xl text-slate-600 max-w-2xl mx-auto">
						Manage all your shipments on the go with our powerful mobile
						application
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
					{appFeatures.map((feature, index) => {
						const Icon = feature.icon;
						return (
							<div
								key={index}
								className={`${feature.bgColor} flex justify-between flex-col rounded-3xl p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2`}
								style={{
									animation: `fadeInUp 0.6s ease-out ${index * 0.15}s both`,
								}}
							>
								<div>
									<div
										className={`w-16 h-16 ${feature.iconBg} rounded-full flex items-center justify-center mb-6 shadow-lg`}
									>
										<Icon className="w-8 h-8 text-white" />
									</div>

									<h3 className="text-2xl font-bold text-slate-900 mb-3">
										{feature.title}
									</h3>
									<p className="text-slate-600 mb-6 leading-relaxed">
										{feature.description}
									</p>
								</div>

								{feature.stats && (
									<div className="bg-white rounded-2xl p-6 shadow-sm">
										<div className="flex items-center justify-between mb-4">
											<span className="text-sm text-slate-500 font-medium">
												Your balance
											</span>
											<Eye className="w-4 h-4 text-slate-400" />
										</div>
										<div className="text-3xl font-bold text-slate-900 mb-6">
											₦52,972
										</div>
										<div className="grid grid-cols-4 gap-3">
											{feature.stats.map((stat, idx) => {
												const StatIcon = stat.icon;
												return (
													<div key={idx} className="flex flex-col items-center">
														<div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-2">
															<StatIcon className="w-5 h-5 text-white" />
														</div>
													</div>
												);
											})}
										</div>
									</div>
								)}

								{feature.partners && (
									<div className="bg-white rounded-2xl p-6 shadow-sm">
										<div className="grid grid-cols-4 gap-4">
											{feature.partners.map((partner, idx) => (
												<div
													key={idx}
													className="bg-slate-50 rounded-xl flex items-center justify-center aspect-square hover:bg-slate-100 transition-colors"
												>
													<Image
														src={partner.logo}
														alt={partner.name}
														width={100}
														height={100}
														className="ml-2 object-cover w-full h-full flex items-center justify-center"
													/>
												</div>
											))}
										</div>
									</div>
								)}

								{feature.metric && (
									<div className="bg-white rounded-2xl p-6 shadow-sm">
										<div className="flex items-center gap-3 mb-4">
											<div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
												<TrendingUp className="w-5 h-5 text-slate-700" />
											</div>
											<span className="text-sm font-medium text-slate-600">
												{feature.metric.label}
											</span>
										</div>
										<div className="flex items-end justify-between">
											<div className="text-3xl font-bold text-slate-900">
												{feature.metric.value}
											</div>
											<div className="flex items-center gap-1">
												<TrendingUp className="w-4 h-4 text-green-500" />
												<span className="text-sm font-semibold text-green-500">
													{feature.metric.trend}
												</span>
											</div>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
