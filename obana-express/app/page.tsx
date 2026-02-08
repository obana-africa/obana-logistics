"use client";

import React from "react";
import { useAuth } from "@/lib/authContext";
import Navigation from "@/components/home/Navigation";
import HeroSection from "@/components/home/Herosection";
import QuickActions from "@/components/home/Quickactions";
import Services from "@/components/home/Services";
import Footer from "@/components/home/Footer";
import ContactFormSection from "@/components/home/Contactformsection";
import ContactForm from "@/components/home/Contactform";
// import Features from "@/components/home/Features";
// import CTASection from "@/components/home/CTASection";
// import StatsSection from "@/components/home/StatsSection";
// import Footer from "@/components/home/Footer";

export default function Home() {
	const { isAuthenticated, isLoading, user, logout } = useAuth();

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
					<p className="text-white text-lg font-medium">Loading...</p>
				</div>
			</div>
		);
	}

	const getDashboardLink = () => {
		if (!user) return "/";
		const dashboards: Record<string, string> = {
			customer: "/dashboard/customer",
			driver: "/dashboard/driver",
			admin: "/dashboard/admin",
			agent: "/dashboard/agent",
		};
		return dashboards[user.role] || "/dashboard/customer";
	};

	return (
		<div className="min-h-screen bg-white">
			<Navigation
				isAuthenticated={isAuthenticated}
				getDashboardLink={getDashboardLink}
				logout={logout}
			/>
			<HeroSection />
			<QuickActions />
			{/* <Features /> */}
			<ContactFormSection />
			<Services />
			{/* <CTASection /> */}
			<ContactForm />
			<Footer />
		</div>
	);
}
