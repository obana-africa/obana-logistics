/**
 * Continue with Google, without putting our server in front of Google.
 *
 * The browser goes straight to accounts.google.com and comes back to a page on
 * this site. Nothing in the address bar names the API, which matters because
 * the consent screen and the URL a person sees during sign-in are the two
 * places a service looks either trustworthy or improvised.
 *
 * Google is given a `state` carrying two things: a nonce, kept in this
 * browser, so a callback that did not start here is refused; and where to
 * return afterwards, so somebody who began on a tracking page lands back on it
 * rather than on a dashboard they did not ask for.
 */

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const NONCE_KEY = "obana_google_nonce";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/** Where Google sends people back. Must match a redirect URI in the console. */
export const googleRedirectUri = () =>
	typeof window === "undefined" ? "" : `${window.location.origin}/auth/google/callback`;

const randomNonce = () => {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** Pack the nonce and the page to return to into Google's `state`. */
const packState = (returnTo: string) => {
	const nonce = randomNonce();
	try {
		sessionStorage.setItem(NONCE_KEY, nonce);
	} catch {
		/* Private windows refuse storage. The sign-in still works; it just
		   cannot prove the callback began here, which is the lesser loss. */
	}
	return btoa(JSON.stringify({ n: nonce, r: returnTo })).replace(/=+$/, "");
};

/**
 * Read `state` back on the way in.
 *
 * Returns the page to go to afterwards, and whether the nonce matched. A
 * mismatch is not fatal on its own — storage may have been cleared — but the
 * caller is told so it can decide.
 */
export const readState = (state: string | null) => {
	let stored: string | null = null;
	try {
		stored = sessionStorage.getItem(NONCE_KEY);
		sessionStorage.removeItem(NONCE_KEY);
	} catch {
		/* as above */
	}
	if (!state) return { returnTo: "", verified: false };
	try {
		const { n, r } = JSON.parse(atob(state)) as { n?: string; r?: string };
		return { returnTo: typeof r === "string" ? r : "", verified: Boolean(n && stored && n === stored) };
	} catch {
		return { returnTo: "", verified: false };
	}
};

/**
 * Only a path on this site, never an address somewhere else.
 *
 * `returnTo` arrives from a query string, so it is somewhere a stranger can
 * write. Without this, a link could send somebody through a real Obana
 * sign-in and out onto a page of their choosing, still trusting the journey.
 */
export const safeReturn = (value: string | null | undefined, fallback: string) => {
	const v = String(value ?? "").trim();
	if (!v.startsWith("/") || v.startsWith("//")) return fallback;
	return v;
};

/** Send the browser to Google. */
export function startGoogleSignIn(returnTo: string) {
	if (!GOOGLE_CLIENT_ID) return false;
	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: googleRedirectUri(),
		response_type: "code",
		scope: "openid email profile",
		include_granted_scopes: "true",
		state: packState(returnTo),
		/* So somebody who has signed in before still gets to choose which
		   account, rather than being silently put into the last one. */
		prompt: "select_account",
	});
	window.location.assign(`${AUTHORIZE}?${params.toString()}`);
	return true;
}
