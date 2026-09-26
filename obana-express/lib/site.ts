// Shared constants and helpers for the public site (landing, quote, docs).

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3006";

/* A domain address, not a free mailbox. Every buyer and every integrator who
   reads the docs sees this one, and a Gmail address on a page selling an API is
   the detail that makes people wonder whether the company is real.

   NOTE: this mailbox has to exist before deploying. Simplest route is a
   forwarding alias on the obana.africa domain pointing at whoever reads the
   Gmail today — the address changes, the person reading it does not. */
export const SUPPORT_EMAIL = "support@obana.africa";

// Falls back to Obana's Cloudinary account so a missing env var can never crash a page.
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dbewrzeuj";

/** Cloudinary URL sized for the screen, in the best format the browser supports. */
export function cld(publicId: string, width: number, extra = "") {
	return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,c_limit,w_${width}${extra ? `,${extra}` : ""}/${publicId}`;
}

/** srcset for 1x / 2x screens. */
export const cldSet = (publicId: string, width: number, extra = "") =>
	`${cld(publicId, width, extra)} 1x, ${cld(publicId, width * 2, extra)} 2x`;

const DASHBOARDS: Record<string, string> = {
	customer: "/dashboard/customer",
	driver: "/dashboard/driver",
	admin: "/dashboard/admin",
	agent: "/dashboard/agent",
};

/** The signed-in user's home — the store uses `account_type`, older code used `role`. */
export function dashboardFor(user: { account_type?: string; role?: string } | null | undefined) {
	return DASHBOARDS[user?.account_type ?? user?.role ?? ""] ?? "/dashboard/customer";
}
