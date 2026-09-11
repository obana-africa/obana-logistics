import type { Metadata } from "next";
import Navigation from "@/components/home/Navigation";
import Footer from "@/components/home/Footer";
import DocsLayout from "@/components/docs/DocsLayout";
import DocsContent from "@/components/docs/DocsContent";

export const metadata: Metadata = {
	title: "API docs",
	description: "Connect your website, Shopify store or app to Obana Logistics: live quotes, shipments, tracking and signed webhooks.",
};

export default function DocsPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Navigation />
			<main className="flex-1 pt-20">
				<DocsLayout>
					<DocsContent />
				</DocsLayout>
			</main>
			<Footer />
		</div>
	);
}
