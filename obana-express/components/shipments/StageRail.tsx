import { whenText } from "@/lib/shipments";

export type Stage = {
	label: string;
	at: string | null;
	done: boolean;
	current: boolean;
};

/**
 * The three stages of a parcel, and when each was reached.
 *
 * One component, used by the page a customer opens from a WhatsApp link and by
 * the page they open from their own dashboard. They were two separate
 * renderings of the same journey — a stage rail in one, a flat list of events
 * in the other — so the same parcel looked like two different things depending
 * on where the customer came in, and only one of them answered "where is it".
 *
 * Vertical on a phone and horizontal from `sm` up: three labels side by side at
 * 360px wrap into each other and read as one word.
 */
export function StageRail({ stages }: { stages: Stage[] }) {
	if (!stages?.length) return null;

	return (
		<ol className="border-y border-slate-100 py-4 sm:flex sm:items-start sm:gap-1">
			{stages.map((stage, i) => (
				<li
					key={stage.label}
					className="relative flex items-center gap-3 pb-4 last:pb-0 sm:flex-1 sm:flex-col sm:gap-0 sm:pb-0 sm:text-center"
				>
					<span
						className={`absolute left-[5px] top-4 h-full w-0.5 sm:hidden ${
							i === stages.length - 1 ? "bg-transparent" : stage.done ? "bg-[#1b3b5f]" : "bg-slate-200"
						}`}
						aria-hidden
					/>
					<span
						className={`z-10 h-3 w-3 shrink-0 rounded-full sm:hidden ${
							stage.current ? "bg-[#1b3b5f] ring-4 ring-[#1b3b5f]/15" : stage.done ? "bg-[#1b3b5f]" : "bg-slate-200"
						}`}
						aria-hidden
					/>

					<div className="hidden w-full items-center sm:flex">
						<span
							className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : stage.done ? "bg-[#1b3b5f]" : "bg-slate-200"}`}
							aria-hidden
						/>
						<span
							className={`h-3 w-3 shrink-0 rounded-full ${
								stage.current ? "bg-[#1b3b5f] ring-4 ring-[#1b3b5f]/15" : stage.done ? "bg-[#1b3b5f]" : "bg-slate-200"
							}`}
							aria-hidden
						/>
						<span
							className={`h-0.5 flex-1 ${
								i === stages.length - 1 ? "bg-transparent" : stages[i + 1].done ? "bg-[#1b3b5f]" : "bg-slate-200"
							}`}
							aria-hidden
						/>
					</div>

					<div className="min-w-0 sm:mt-2">
						<p className={`text-xs font-semibold ${stage.done ? "text-slate-900" : "text-slate-400"}`}>
							{stage.label}
						</p>
						<p className="text-[11px] text-slate-500">{stage.at ? whenText(stage.at) : "—"}</p>
					</div>
				</li>
			))}
		</ol>
	);
}
