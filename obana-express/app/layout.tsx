import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/authContext";

// Self-hosted by Next.js: no layout shift, no request to Google at page load.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
	metadataBase: new URL("https://logistics.obana.africa"),
	title: {
		default: "Obana Logistics — Deliveries across Nigeria and Africa",
		template: "%s · Obana Logistics",
	},
	description:
		"Send a package, fulfil your business orders or connect deliveries to your platform with our API. Live tracking and WhatsApp updates on an electric-vehicle fleet.",
	icons: {
		icon: "https://res.cloudinary.com/dbewrzeuj/image/upload/q_auto/f_auto/v1778253380/favicon_nxkdui.ico",
	},
	openGraph: {
		title: "Obana Logistics — Deliveries across Nigeria and Africa",
		description: "For individuals, businesses and developers: book, track and integrate deliveries in minutes.",
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
