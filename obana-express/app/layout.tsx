import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/authContext";

/* Obana's brand fonts (as on obana.africa) — Bricolage Grotesque for
   headings, Inter for text. Served from this repo.
   
   The note that used to sit here said "self-hosted by Next.js: no request to
   Google", and that was half true: next/font/google self-hosts what it
   serves to the BROWSER, but it downloads each family from fonts.gstatic.com
   while the BUILD runs. When that call fails Next does not fall back — it
   still emits the CSS module, now pointing at files it never wrote — and the
   deploy dies with "module-not-found" inside
   bricolage_grotesque_<hash>.module.css. Nothing in the repo is wrong when
   that happens, which is why it builds locally and fails on the host.
   
   The files are here now, so the build makes no font request at all and this
   cannot happen again. Same faces: the variable woff2 Google was serving,
   latin subset. Variable, so the weight list is gone — 400 through 800 all
   live in the one file.
   
   Both are SIL Open Font License, so shipping them is allowed. */
const inter = localFont({
	src: "./fonts/Inter.woff2",
	variable: "--font-inter",
	display: "swap",
	// Measured off the real face, so the first paint does not jump when the
	// font swaps in.
	adjustFontFallback: "Arial",
	fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
const bricolage = localFont({
	src: "./fonts/BricolageGrotesque.woff2",
	variable: "--font-bricolage",
	display: "swap",
	adjustFontFallback: "Arial",
	fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
	metadataBase: new URL("https://logistics.obana.africa"),
	title: {
		default: "Obana Logistics — EV-powered fulfilment across Africa",
		template: "%s · Obana Logistics",
	},
	description:
		"International shipping from Europe to Africa, plus nationwide delivery in Nigeria. Create shipments, track them in real time and plug logistics into your platform with our API.",
	openGraph: {
		title: "Obana Logistics — EV-powered fulfilment across Africa",
		description: "Create shipments, track deliveries and integrate logistics into your platform.",
		url: "https://logistics.obana.africa",
		siteName: "Obana Logistics",
		type: "website",
	},
};

export const viewport: Viewport = {
	themeColor: "#1b3b5f",
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
			<body>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
