"use client";

import React from "react";
import Link from "next/link";
import {
	User,
	Package,
	Store,
	Truck,
	ArrowRight,
	Users,
	ShoppingBag,
	Wrench,
} from "lucide-react";

const userProfiles = [
	{
		icon: User,
		title: "For Senders",
		description:
			"Send packages to loved ones or customers with ease. Track every delivery from pickup to doorstep.",
		bgGradient: "from-blue-500 to-blue-600",
		bgColor: "bg-blue-50",
		iconBg: "bg-[#1B3E5D] ",
		link: "/auth/signup?role=customer",
		benefits: [
			"Instant price quotes",
			"Real-time tracking",
			"Flexible delivery options",
		],
	},
	{
		icon: Store,
		title: "For Businesses",
		description:
			"Scale your e-commerce with our business solutions. Integrate seamlessly and ship worldwide.",

		bgGradient: "from-amber-500 to-amber-600",
		bgColor: "bg-amber-50",
		iconBg: "bg-gradient-to-br from-amber-400 to-amber-600",

		link: "/auth/signup?role=business",
		benefits: [
			"Bulk shipping discounts",
			"API integration",
			"Dedicated support",
		],
	},
	{
		icon: Truck,
		title: "For Drivers",
		description:
			"Join our driver network and earn on your schedule. Flexible hours, fair compensation.",
		bgGradient: "from-purple-500 to-purple-600",
		bgColor: "bg-purple-50",
		iconBg: " bg-[#1B3E5D] ",
		link: "/auth/signup?role=driver",
		benefits: ["Flexible schedule", "Weekly payouts", "Insurance coverage"],
	},
];

export default function UserProfilesSection() {
	return (
		<section className="pt-24 bg-white relative overflow-hidden">
			{/* Background Pattern */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
				<div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
				<div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
			</div>

			<div className="max-w-7xl mx-auto px-6 relative">
				{/* Header */}
				<div className="text-center mb-16">
					<div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full mb-4">
						<Users className="w-4 h-4" />
						<span className="text-sm font-semibold">Join Our Network</span>
					</div>
					<h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
						Who can benefit from{" "}
						<span className="text-transparent bg-clip-text bg-[#1B3E5D] ">
							Obana Logistics
						</span>
					</h2>
					<p className="text-xl text-slate-600 max-w-2xl mx-auto">
						Pick a profile and sign up to get started with seamless logistics
					</p>
				</div>

				{/* Profile Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					{userProfiles.map((profile, index) => {
						const Icon = profile.icon;
						return (
							<Link
								key={index}
								href={profile.link}
								className="group"
								style={{
									animation: `fadeInUp 0.6s ease-out ${index * 0.15}s both`,
								}}
							>
								<div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100 relative overflow-hidden">
									{/* Gradient Background on Hover */}
									<div
										className={`absolute inset-0 bg-linear-to-br ${profile.bgGradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
									/>

									<div className="relative">
										{/* Icon */}
										<div
											className={`w-20 h-20 ${profile.iconBg} rounded-full flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300`}
										>
											<Icon className="w-10 h-10 text-white" />
										</div>

										{/* Title & Description */}
										<h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-[#1B3E5D] transition-colors">
											{profile.title}
										</h3>
										<p className="text-slate-600 mb-6 leading-relaxed">
											{profile.description}
										</p>

										{/* Benefits List */}
										<ul className="space-y-2 mb-6">
											{profile.benefits.map((benefit, idx) => (
												<li
													key={idx}
													className="flex items-center gap-2 text-sm text-[#1B3E5D]"
												>
													<div className="w-1.5 h-1.5 rounded-full bg-[#1B3E5D]" />
													{benefit}
												</li>
											))}
										</ul>

										{/* CTA */}
										<div className="flex items-center gap-2 text-[#1B3E5D] font-semibold group-hover:gap-3 transition-all">
											Get Started
											<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
										</div>
									</div>
								</div>
							</Link>
						);
					})}
				</div>

				{/* Additional Info */}
				<div className="mt-16 text-center">
					<p className="text-slate-600 mb-4">
						Not sure which option is right for you?
					</p>
					<Link
						href="/contact"
						className="text-[#1B3E5D] font-semibold hover:underline inline-flex items-center gap-2"
					>
						Contact our team for guidance
						<ArrowRight className="w-4 h-4" />
					</Link>
				</div>
			</div>
		</section>
	);
}
