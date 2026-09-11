import Image from "next/image";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

// Only links that lead somewhere real.
const COLUMNS = [
	{
		heading: "Ship",
		links: [
			{ label: "Send a package", href: "/auth/signup" },
			{ label: "Get a quote", href: "/route-match" },
			{ label: "Track a shipment", href: "/#track" },
			{ label: "For business", href: "/#business" },
		],
	},
	{
		heading: "Developers",
		links: [
			{ label: "API documentation", href: "/docs" },
			{ label: "Get an API key", href: "/onboarding/business" },
		],
	},
	{
		heading: "Join",
		links: [
			{ label: "Drive with Obana", href: "/auth/signup" },
			{ label: "Become an agent", href: "/auth/signup" },
			{ label: "Sign in", href: "/auth/login" },
		],
	},
	{
		heading: "Support",
		links: [{ label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` }],
	},
];

export function SiteFooter() {
	return (
		<footer className="bg-navy-950 text-white">
			<div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
				<div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
					<div>
						{/* The brand logo turned white with CSS — small and always matches the header logo. */}
						<Image src="/logo-blue.png" alt="Obana Logistics" width={120} height={48} className="h-9 w-auto brightness-0 invert" />
						<p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
							Electric-vehicle deliveries for individuals and businesses across Nigeria and Africa — with an API for platforms.
						</p>
					</div>
					<div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
						{COLUMNS.map((col) => (
							<div key={col.heading}>
								<h2 className="font-sans text-sm font-semibold tracking-normal text-white">{col.heading}</h2>
								<ul className="mt-3 space-y-2.5">
									{col.links.map((l) => (
										<li key={l.label}>
											<Link href={l.href} className="break-all text-sm text-white/60 transition-colors hover:text-white">
												{l.label}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				<p className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
					© {new Date().getFullYear()} Obana.Africa — a trademark of ICON Tech &amp; Ecom Services Ltd. All rights reserved.
				</p>
			</div>
		</footer>
	);
}
