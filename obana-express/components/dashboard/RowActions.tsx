"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface RowAction {
	label: string;
	onSelect: () => void;
	/** Red, and set apart from the rest. For anything that destroys something. */
	danger?: boolean;
	icon?: React.ReactNode;
}

/**
 * The three-dot menu at the end of a row.
 *
 * Destructive actions live in here rather than on the row itself, so deleting
 * takes a deliberate look for it instead of sitting one stray click from
 * everything else.
 */
export default function RowActions({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const away = (e: MouseEvent) => {
			if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
		};
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", away);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("mousedown", away);
			document.removeEventListener("keydown", esc);
		};
	}, [open]);

	if (!actions.length) return null;

	return (
		<div ref={box} className="relative inline-block text-left">
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setOpen((v) => !v);
				}}
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
			>
				<MoreVertical size={16} />
			</button>

			{open && (
				<div
					role="menu"
					className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
				>
					{actions.map((action, i) => (
						<button
							key={action.label}
							role="menuitem"
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setOpen(false);
								action.onSelect();
							}}
							className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
								action.danger
									? "text-red-600 hover:bg-red-50"
									: "text-slate-700 hover:bg-slate-50"
							} ${action.danger && i > 0 ? "mt-1 border-t border-slate-100 pt-2" : ""}`}
						>
							{action.icon}
							{action.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
