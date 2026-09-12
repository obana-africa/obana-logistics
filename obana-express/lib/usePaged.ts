"use client";

import { useState } from "react";

/**
 * Page through a list that is already loaded (search and filters run on the whole list first).
 * Goes back to page 1 whenever `resetKey` changes, e.g. a new search, and never points past the last page.
 */
export function usePaged<T>(items: T[], pageSize = 20, resetKey = "") {
	const [state, setState] = useState({ key: resetKey, page: 1 });
	// New search or filter: start again from page 1 (adjusted during render, no effect needed).
	if (state.key !== resetKey) setState({ key: resetKey, page: 1 });
	const pages = Math.max(1, Math.ceil(items.length / pageSize));
	const page = Math.min(state.key === resetKey ? state.page : 1, pages);
	const start = (page - 1) * pageSize;
	return {
		page,
		pages,
		total: items.length,
		items: items.slice(start, start + pageSize),
		setPage: (next: number) => setState({ key: resetKey, page: Math.max(1, Math.min(next, pages)) }),
	};
}
