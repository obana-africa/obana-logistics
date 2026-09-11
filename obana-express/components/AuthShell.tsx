import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Globe2, MapPinned, PlugZap } from "lucide-react";

/** Shared frame for sign-in, sign-up and password pages: brand panel on desktop, clean single column on phones. */
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
	return (
		<div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_1.1fr]">
			<aside className="relative hidden overflow-hidden bg-[#1B3B5F] p-12 text-white lg:flex lg:flex-col lg:justify-between">
				<div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5 blur-2xl" />
				<Link href="/" aria-label="Obana Logistics home" className="w-fit">
					<Image src="/logo-blue.png" alt="Obana Logistics" width={150} height={64} className="h-12 w-auto brightness-0 invert" priority />
				</Link>
				<div className="relative max-w-md">
					<p className="text-4xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
						Ship from Europe to Africa — and across Nigeria.
					</p>
					<ul className="mt-8 space-y-4 text-[15px] text-white/80">
						{[
							{ icon: Globe2, text: "One booking and one price, from pickup to the final doorstep" },
							{ icon: MapPinned, text: "Live tracking with email and WhatsApp updates" },
							{ icon: PlugZap, text: "An API to connect your store or platform" },
						].map(({ icon: Icon, text }) => (
							<li key={text} className="flex items-start gap-3">
								<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
									<Icon className="h-4 w-4 text-amber-300" aria-hidden />
								</span>
								<span className="pt-1">{text}</span>
							</li>
						))}
					</ul>
				</div>
				<p className="relative text-xs text-white/50">© {new Date().getFullYear()} Obana.Africa</p>
			</aside>

			<main className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:px-16">
				<Link href="/" aria-label="Obana Logistics home" className="mb-10 w-fit lg:hidden">
					<Image src="/logo-blue.png" alt="Obana Logistics" width={120} height={51} className="h-10 w-auto" priority />
				</Link>
				<div className={`mx-auto w-full ${wide ? "max-w-xl" : "max-w-md"}`}>{children}</div>
			</main>
		</div>
	);
}
