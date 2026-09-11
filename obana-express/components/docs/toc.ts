// Sections of the developer docs, in page order. Ids match the <section id> in DocsContent.

export const TOC = [
	{
		group: "Get started",
		items: [
			{ id: "quickstart", label: "Quickstart" },
			{ id: "authentication", label: "Authentication" },
			{ id: "responses", label: "Responses & errors" },
		],
	},
	{
		group: "Shipments",
		items: [
			{ id: "quote", label: "Get a quote" },
			{ id: "create-shipment", label: "Create a shipment" },
			{ id: "list-shipments", label: "List your shipments" },
			{ id: "track-shipment", label: "Track a shipment" },
			{ id: "cancel-shipment", label: "Cancel a shipment" },
			{ id: "statuses", label: "Shipment statuses" },
		],
	},
	{
		group: "Webhooks",
		items: [
			{ id: "webhooks", label: "Receive events" },
			{ id: "verify-signatures", label: "Verify signatures" },
		],
	},
	{
		group: "Launch",
		items: [
			{ id: "go-live", label: "Going live" },
			{ id: "support", label: "Support" },
		],
	},
];

export const TOC_ITEMS = TOC.flatMap((g) => g.items);
