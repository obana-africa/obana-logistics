"use client";

import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { Alert, Button, Checkbox } from "@/components/ui";
import { CodeBox, CopyButton } from "@/components/stores/Copy";
import { testCurl } from "@/components/stores/stores";

/** Shows a full API key exactly once: copy, warning, a test request and an "I've saved it" gate before moving on. */
export function KeyReveal({ apiKey, storeName, onDone, doneLabel = "Continue" }: { apiKey: string; storeName?: string; onDone: () => void; doneLabel?: string }) {
	const [saved, setSaved] = useState(false);
	return (
		<div className="space-y-4">
			<div className="min-w-0 rounded-2xl bg-slate-900 p-4">
				<div className="flex items-center justify-between gap-3">
					<p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
						<KeyRound className="h-3.5 w-3.5" aria-hidden /> {storeName ? `API key · ${storeName}` : "API key"}
					</p>
					<CopyButton text={apiKey} label="Copy key" dark />
				</div>
				<code data-testid="api-key" className="mt-3 block break-all font-mono text-sm leading-relaxed text-emerald-300">
					{apiKey}
				</code>
			</div>

			<Alert type="warning">
				<strong className="font-semibold">This is the only time we&apos;ll show this key.</strong> Copy it now and keep it on your server — never in your website or app code. If you lose it,
				create a new one and the old one stops working.
			</Alert>

			<div className="space-y-2">
				<p className="text-sm font-medium text-slate-800">Try it — paste this in a terminal:</p>
				<CodeBox code={testCurl(apiKey)} />
			</div>

			<Checkbox label="I've saved my key" checked={saved} onChange={(e) => setSaved(e.target.checked)} />

			<Button size="lg" fullWidth disabled={!saved} onClick={onDone}>
				{doneLabel}
			</Button>
		</div>
	);
}
