"use client";

import { useEffect, useRef, useState } from "react";

/** Pull a readable message out of an axios/fetch error. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
	const e = err as { response?: { data?: { message?: string } }; message?: string };
	return e?.response?.data?.message || e?.message || fallback;
}

type Result<T> = { key: string | null; attempt: number; data: T | null; error: string | null };

/**
 * Load data for a key (e.g. "customer-stats:42"). Pass key=null to wait (e.g. until the user is known).
 * Loading is derived, so there is no setState inside the effect body; retry() refetches.
 */
export function useRemote<T>(key: string | null, fetcher: () => Promise<T>) {
	const [attempt, setAttempt] = useState(0);
	const [result, setResult] = useState<Result<T>>({ key: null, attempt: -1, data: null, error: null });
	const fetcherRef = useRef(fetcher);

	useEffect(() => {
		fetcherRef.current = fetcher;
	});

	useEffect(() => {
		if (key === null) return;
		let alive = true;
		fetcherRef.current().then(
			(data) => alive && setResult({ key, attempt, data, error: null }),
			(err) => alive && setResult({ key, attempt, data: null, error: errorMessage(err) }),
		);
		return () => {
			alive = false;
		};
	}, [key, attempt]);

	const fresh = result.key === key && result.attempt === attempt;
	return {
		data: result.key === key ? result.data : null,
		error: fresh ? result.error : null,
		loading: key === null || !fresh,
		retry: () => setAttempt((a) => a + 1),
	};
}
