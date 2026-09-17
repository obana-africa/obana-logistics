// Shared shipment display helpers so every dashboard shows statuses, money and dates the same way.

export type ShipmentStatus =
	| "pending"
	| "confirmed"
	| "picked_up"
	| "dispatched"
	| "in_transit"
	| "delivered"
	| "failed"
	| "cancelled"
	| "returned";

export type Tone = "neutral" | "info" | "progress" | "success" | "danger" | "warning";

// Mirrors the status ENUM in Backend/src/models/shipmentsModel.js.
//
// The labels are deliberately coarser than the statuses. A dispatcher needs to
// know whether a parcel is picked up or already dispatched; a customer only
// wants to know it is on its way, and the sales order it came from says the
// same three things. So everything between the box being made and the parcel
// arriving reads as In Transit, and the underlying status still drives the
// board, the filters and the driver's screen.
export const STATUS_META: Record<ShipmentStatus, { label: string; tone: Tone }> = {
	pending: { label: "Package Created", tone: "info" },
	confirmed: { label: "Package Created", tone: "info" },
	picked_up: { label: "In Transit", tone: "progress" },
	dispatched: { label: "In Transit", tone: "progress" },
	in_transit: { label: "In Transit", tone: "progress" },
	delivered: { label: "Fulfilled", tone: "success" },
	failed: { label: "Failed", tone: "danger" },
	cancelled: { label: "Cancelled", tone: "neutral" },
	returned: { label: "Returned", tone: "danger" },
};

// Three statuses now share a label, so the filter would read "In Transit"
// three times. Keep the precise wording where someone is choosing what to
// filter by, and the customer wording where they are being told what happened.
const FILTER_LABEL: Record<ShipmentStatus, string> = {
	pending: "Pending",
	confirmed: "Confirmed",
	picked_up: "Picked up",
	dispatched: "Dispatched",
	in_transit: "In transit",
	delivered: "Delivered",
	failed: "Failed",
	cancelled: "Cancelled",
	returned: "Returned",
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as ShipmentStatus[]).map((value) => ({ value, label: FILTER_LABEL[value] }));

/** Statuses after which a shipment no longer moves. */
export const CLOSED_STATUSES: ShipmentStatus[] = ["delivered", "failed", "cancelled", "returned"];

export function statusMeta(status?: string | null) {
	const key = (status ?? "").toLowerCase() as ShipmentStatus;
	return STATUS_META[key] ?? { label: status ? status.replace(/_/g, " ") : "Unknown", tone: "neutral" as Tone };
}

export function formatMoney(amount: number | string | null | undefined, currency = "NGN") {
	const value = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
	if (!Number.isFinite(value)) return "—";
	try {
		return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 0 }).format(value as number);
	} catch {
		return `${currency} ${(value as number).toLocaleString()}`;
	}
}

export function formatDate(value?: string | Date | null) {
	if (!value) return "—";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(value?: string | Date | null) {
	if (!value) return "";
	const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
	if (!Number.isFinite(seconds)) return "";
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return formatDate(value);
}

type Place = { city?: string | null; state?: string | null; country?: string | null } | null | undefined;

export function placeLabel(place: Place) {
	if (!place) return "—";
	return place.city || place.state || place.country || "—";
}

export function routeLabel(from: Place, to: Place) {
	return `${placeLabel(from)} → ${placeLabel(to)}`;
}
