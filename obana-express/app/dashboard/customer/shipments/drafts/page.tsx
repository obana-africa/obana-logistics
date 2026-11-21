"use client";

/* The same list for a customer. Drafts are saved from the same booking form
   whichever dashboard it is opened from, so leaving this out meant a
   customer could save one and never see it again. */

import ShipmentDrafts from "@/components/shipments/ShipmentDrafts";

export default function CustomerShipmentDraftsPage() {
	return <ShipmentDrafts role="customer" />;
}
