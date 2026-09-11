import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { AuthProvider } from "@/lib/authContext";

// Obana's fonts — Sora for headings, Inter for text. Self-hosted by Next.js: no layout shift, no Google request.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["400", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
	metadataBase: new URL("https://logistics.obana.africa"),
	title: {
		default: "Obana Logistics — EV-powered fulfilment across Africa",
		template: "%s · Obana Logistics",
	},
	description:
		"Create shipments, track deliveries in real time and plug logistics into your platform with our API. EV-powered fulfilment for businesses across Africa.",
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
		<html lang="en" className={`${inter.variable} ${sora.variable}`}>
			<body>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
