
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import type { Metadata } from "next";


export const metadata: Metadata = {
	title: "logistics.obana.africa",
	description: "Obana Logistics Express - Fast, Reliable, and Affordable Delivery Services Worldwide",
	icons: {
		icon: "/favicon.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
