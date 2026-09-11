import type { MetadataRoute } from "next";

// Lets people add Obana Logistics to their phone's home screen with a proper icon.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Obana Logistics",
		short_name: "Obana",
		description: "Create shipments, track deliveries and manage logistics across Africa.",
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#1b3b5f",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
