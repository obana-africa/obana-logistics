
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import type { Metadata } from "next";


export const metadata: Metadata = {
	title: "logistics.obana.africa",
	description: "Obana Logistics Express - Fast, Reliable, and Affordable Delivery Services Worldwide",
	icons: {
		icon: "https://res.cloudinary.com/dbewrzeuj/image/upload/q_auto/f_auto/v1778253380/favicon_nxkdui.ico",
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
