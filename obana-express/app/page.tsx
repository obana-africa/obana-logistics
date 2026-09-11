import Navigation from "@/components/home/Navigation";
import HeroSection from "@/components/home/Herosection";
import QuickActions from "@/components/home/Quickactions";
import MultipleRoles from "@/components/home/MultipleRoles";
import HowItWorks from "@/components/home/HowItWorks";
import FAQ from "@/components/home/FAQ";
import Partners from "@/components/home/Partners";
import CrossBorderCTA from "@/components/home/CrossBorderCTA";
import Footer from "@/components/home/Footer";

// Server-rendered: the page shows straight away — no full-screen spinner while sign-in loads.
// The header reads the signed-in state itself once the page is in the browser.
export default function Home() {
	return (
		<div className="min-h-screen bg-white">
			<Navigation />
			<HeroSection />
			<QuickActions />
			<MultipleRoles />
			<HowItWorks />
			<FAQ />
			<Partners />
			<CrossBorderCTA />
			<Footer />
		</div>
	);
}
