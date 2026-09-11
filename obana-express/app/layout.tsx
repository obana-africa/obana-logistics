import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/authContext";

// Obana's brand fonts (as on obana.africa) — Bricolage Grotesque for headings, Inter for text.
// Self-hosted by Next.js: no layout shift, no request to Google.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["400", "600", "700", "800"], display: "swap" });

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
