/**
 * Hold the page still while something is open on top of it.
 *
 * Four things lock scrolling — the menu drawer, the tracking modal, the
 * document viewer and the sheets — and each used to save `body.style.overflow`
 * for itself and put it back on close. That is correct alone and wrong
 * together:
 *
 *   drawer opens            saves "", sets hidden
 *   viewer opens on top     saves "hidden", sets hidden
 *   drawer closes           restores ""        — scrolling works again
 *   viewer closes           restores "hidden"  — and the page is stuck
 *
 * Stuck for good: no click fixes it, only a reload. So the lock is counted
 * here instead. The first thing to open takes the page's own value, the last
 * thing to close puts it back, and anything in between changes nothing.
 */

let depth = 0;
let saved = "";

/** Lock scrolling. Call the returned function to release this one hold. */
export function lockScroll(): () => void {
	let released = false;

	if (typeof document !== "undefined") {
		if (depth === 0) saved = document.body.style.overflow;
		depth += 1;
		document.body.style.overflow = "hidden";
	}

	return () => {
		/* Guarded: React runs an effect's cleanup once, but a caller that
		   releases twice would otherwise drop the count below zero and let the
		   next lock restore the wrong value. */
		if (released || typeof document === "undefined") return;
		released = true;
		depth = Math.max(0, depth - 1);
		if (depth === 0) document.body.style.overflow = saved;
	};
}
