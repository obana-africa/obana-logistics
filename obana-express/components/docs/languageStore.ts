"use client";

import { useSyncExternalStore } from "react";

// The reader's chosen code language, shared by every code block on the page and remembered between visits.

export type Lang = "curl" | "node" | "python" | "php";

export const LANGS: { id: Lang; label: string }[] = [
	{ id: "curl", label: "cURL" },
	{ id: "node", label: "Node.js" },
	{ id: "python", label: "Python" },
	{ id: "php", label: "PHP" },
];

const STORAGE_KEY = "obana-docs-lang";
const DEFAULT_LANG: Lang = "curl";
const listeners = new Set<() => void>();
let current: Lang | null = null;

const isLang = (value: unknown): value is Lang => LANGS.some((l) => l.id === value);

function read(): Lang {
	if (current) return current;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		current = isLang(saved) ? saved : DEFAULT_LANG;
	} catch {
		current = DEFAULT_LANG;
	}
	return current;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key !== STORAGE_KEY) return;
		current = null;
		listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

export function setLang(lang: Lang) {
	current = lang;
	try {
		localStorage.setItem(STORAGE_KEY, lang);
	} catch {
		// Private mode or storage blocked: the choice still applies for this visit.
	}
	listeners.forEach((listener) => listener());
}

export function useLang(): Lang {
	return useSyncExternalStore(subscribe, read, () => DEFAULT_LANG);
}
