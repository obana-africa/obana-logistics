import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Audiences, Developers, Earn, FAQ, FinalCta, Hero, HowItWorks, Partners } from "@/components/landing/Sections";

// Server-rendered and static: the page appears immediately, no sign-in check first.
export default function Home() {
	return (
		<div className="min-h-screen bg-white">
			<SiteHeader />
			<main>
				<Hero />
				<Partners />
				<Audiences />
				<HowItWorks />
				<Developers />
				<Earn />
				<FAQ />
				<FinalCta />
			</main>
			<SiteFooter />
		</div>
	);
}
