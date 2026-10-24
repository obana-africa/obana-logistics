"use client";

import { useEffect, useState } from "react";
import { googleClientId, startGoogleSignIn } from "@/lib/googleAuth";

/**
 * Continue with Google.
 *
 * Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset, rather than
 * offering a button that cannot work: an environment without the id should
 * look like a site that does not do Google, not like one that is broken.
 */
export function GoogleButton({ label, returnTo = "" }: { label: string; returnTo?: string }) {
	/* Whether Google is configured at all is the server's answer, so nothing
	   needs setting on the hosting platform. Until it replies the button stays
	   hidden rather than flashing and disappearing. */
	const [available, setAvailable] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		googleClientId().then((id) => {
			if (!cancelled) setAvailable(Boolean(id));
		});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!available) return null;

	return (
		<div className="space-y-4">
			<button
				type="button"
				onClick={() => {
					setBusy(true);
					startGoogleSignIn(returnTo).then((started) => {
						if (!started) setBusy(false);
					});
				}}
				disabled={busy}
				className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 text-sm transition-colors hover:bg-slate-50"
			>
				{/* Google's mark as their brand terms require it: drawn, not
				    recoloured, and not swapped for a generic icon. */}
				<svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
					<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
					<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
					<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
					<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
				</svg>
				{busy ? "Taking you to Google…" : label}
			</button>

			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-slate-200" />
				<span className="text-slate-400 text-xs">or</span>
				<span className="h-px flex-1 bg-slate-200" />
			</div>
		</div>
	);
}

export default GoogleButton;
