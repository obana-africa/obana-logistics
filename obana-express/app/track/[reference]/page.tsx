import { redirect } from "next/navigation";

/**
 * /track/OBN-… → /?track=OBN-…
 *
 * Tracking lives on the home page behind a ?track= parameter, so this path
 * never existed and every link of this shape 404s. It was written into Zoho on
 * every order that synced before it was noticed, and those links are in sales
 * orders and inboxes now — they cannot be recalled, so the path is made to work
 * rather than left dead.
 *
 * Worth keeping regardless: /track/<reference> is the shape people type from
 * memory and the shape anyone would guess.
 */
export default async function TrackRedirect({ params }: { params: Promise<{ reference: string }> }) {
	const { reference } = await params;
	redirect(`/?track=${encodeURIComponent(reference)}`);
}
