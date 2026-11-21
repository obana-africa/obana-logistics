/**
 * The domestic lane that would carry the last mile, and what it charges.
 *
 * An international lane lands freight in one Nigerian city and the goods
 * still have to reach the customer. That inland leg is almost always a route
 * this platform already sells — Lagos → Port Harcourt exists, is priced, and
 * is booked on its own every day. Making an admin look that price up and
 * retype it into the international lane is how the two drift apart.
 *
 * So: pick the arrival state, and if a domestic route already runs from the
 * landing city to it, its price comes back ready to use.
 *
 * Nothing here changes how international or domestic lanes are priced. It
 * reads the routes that already exist and suggests one of their figures.
 */

import type { RouteTemplate } from "./model";

/** Compared the way the route table is matched: case and spacing folded. */
const norm = (v: unknown) =>
    String(v ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};

export type LastMileMatch = {
    route: RouteTemplate;
    /** Total for the weight asked about, in naira. */
    price: number;
    /** Naira per kilo at that weight, for the rate box. */
    perKg: number;
    eta: string | null;
};

/**
 * The bracket covering `weight`.
 *
 * Brackets may share an edge (0–5, 5–10), so the lower bound is inclusive and
 * the upper inclusive too — the same reading the server's own pricing uses.
 * The heaviest bracket catches anything above it, because a route that stops
 * quoting past its last bracket would silently drop the leg.
 */
export function bracketForWeight(
    brackets: { min_weight?: unknown; max_weight?: unknown; price?: unknown; eta?: unknown }[] | null | undefined,
    weight: number,
) {
    const rows = (Array.isArray(brackets) ? brackets : [])
        .filter((b) => Number.isFinite(num(b.min_weight)) && num(b.price) > 0)
        .sort((a, b) => num(a.min_weight) - num(b.min_weight));
    if (!rows.length) return null;
    const hit = rows.find((b) => {
        const min = num(b.min_weight);
        const max = num(b.max_weight);
        return weight >= min && (!Number.isFinite(max) || weight <= max);
    });
    return hit ?? rows[rows.length - 1];
}

/**
 * A domestic route from `fromCity` into `toState`, priced at `weight`.
 *
 * Matched on the DESTINATION STATE rather than the city, because that is what
 * an arrival is known by and what the server matches on. The city is used
 * only to pick between several routes into the same state — a preference, not
 * a requirement, so a state with one route still matches however its city is
 * spelled.
 */
export function findLastMileRoute(
    routes: RouteTemplate[],
    fromCity: string,
    toState: string,
    weight: number,
    toCity?: string,
): LastMileMatch | null {
    if (!norm(fromCity) || !norm(toState)) return null;

    const candidates = (routes ?? []).filter((r) => {
        if (norm(r.origin_city) !== norm(fromCity)) return false;
        const meta = r.metadata as { destination_state?: unknown } | null | undefined;
        const state = norm(meta?.destination_state) || norm(r.destination_city);
        return state === norm(toState) || norm(r.destination_city) === norm(toState);
    });
    if (!candidates.length) return null;

    /* Prefer the exact arrival city when one is named, then road, then the
       cheapest — a last mile is a truck, and the cheapest road option is the
       one an admin would have chosen by hand. */
    const byCity = toCity ? candidates.filter((r) => norm(r.destination_city) === norm(toCity)) : [];
    const pool = byCity.length ? byCity : candidates;
    const road = pool.filter((r) => norm(r.transport_mode) === "road");
    const priced = (road.length ? road : pool)
        .map((r) => {
            const b = bracketForWeight(r.weight_brackets, weight);
            return b ? { route: r, bracket: b } : null;
        })
        .filter((x): x is { route: RouteTemplate; bracket: NonNullable<ReturnType<typeof bracketForWeight>> } => x !== null)
        .sort((a, b) => num(a.bracket.price) - num(b.bracket.price));
    if (!priced.length) return null;

    const { route, bracket } = priced[0];
    const price = num(bracket.price);
    if (!(price > 0)) return null;
    return {
        route,
        price,
        perKg: weight > 0 ? price / weight : 0,
        eta: bracket.eta ? String(bracket.eta) : null,
    };
}
