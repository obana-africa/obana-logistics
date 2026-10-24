"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { googleRedirectUri, readState, safeReturn } from "@/lib/googleAuth";
import { dashboardFor } from "@/lib/site";

/**
 * Where Google sends people back.
 *
 * It holds the code for as long as it takes to hand it to the API, and then
 * gets out of the way — either into the app, or on to the signup form with
 * everything Google already told us filled in. Nobody should have to read
 * anything on this page.
 */

function Landing() {
	const router = useRouter();
	const params = useSearchParams();
	const store = useAuthStore();
	const [error, setError] = useState("");
	/* React mounts an effect twice in development. Exchanging an authorisation
	   code twice fails the second time, by design, and the failure is the one
	   the person would see. */
	const used = useRef(false);

	useEffect(() => {
		if (used.current) return;
		used.current = true;

		const code = params.get("code");
		const { returnTo } = readState(params.get("state"));
		const denied = params.get("error");

		if (denied || !code) {
			router.replace(`/auth/login?error=${encodeURIComponent(denied || "google_cancelled")}`);
			return;
		}

		apiClient
			.googleExchange(code, googleRedirectUri())
			.then((data) => {
				/* No account yet. Google has told us who they are, so the form
				   opens filled in and asks only for what Google cannot give —
				   a phone number, and what kind of account this is. */
				if (data?.needs_signup && data.google_token) {
					const q = new URLSearchParams({
						google_token: data.google_token,
						email: data.profile?.email ?? "",
						first_name: data.profile?.first_name ?? "",
						last_name: data.profile?.last_name ?? "",
						...(returnTo ? { returnTo } : {}),
					});
					router.replace(`/auth/signup?${q.toString()}`);
					return;
				}

				if (!data?.access_token || !data?.user) {
					setError("That sign-in did not complete. Please try again.");
					return;
				}

				store.setUser(data.user as never);
				store.setAccessToken(data.access_token);
				store.setAuthenticated(true);
				if (typeof window !== "undefined" && data.refresh_token) {
					localStorage.setItem("refresh_token", data.refresh_token);
				}
				router.replace(safeReturn(returnTo, dashboardFor(data.user as { role?: string })));
			})
			.catch(() => setError("We could not reach Obana to finish signing you in. Please try again."));
	}, [params, router, store]);

	if (error) {
		return (
			<div className="mx-auto max-w-sm px-4 py-20 text-center">
				<p className="text-rose-600 text-sm">{error}</p>
				<button
					type="button"
					onClick={() => router.replace("/auth/login")}
					className="mt-4 rounded-lg bg-[#1b3b5f] px-4 py-2 font-semibold text-sm text-white"
				>
					Back to sign in
				</button>
			</div>
		);
	}

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<p className="flex items-center gap-2 text-slate-500 text-sm">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing you in…
			</p>
		</div>
	);
}

export default function GoogleCallbackPage() {
	/* useSearchParams needs a boundary for the static build. */
	return (
		<Suspense fallback={null}>
			<Landing />
		</Suspense>
	);
}
