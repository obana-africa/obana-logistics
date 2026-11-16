'use strict';

/**
 * Pricing a lane so the faster service is never the cheaper one.
 *
 * Separate from the migration that applies it so it can be read and tested
 * without a database, the way routeUplift is.
 */

/** Fastest first. A level we do not recognise is left out of the ordering. */
const SPEED = { express: 0, standard: 1, economy: 2 };

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Which lane a route belongs to, for the purpose of comparing its services.
 *
 * Mode is part of it. Lagos to Abuja sells road Express at ₦21,500 and air
 * Express at ₦15,000, and air being dearer than road is not an error — it is
 * a different journey. Only services that are the same journey by the same
 * means are ranked against each other.
 */
function laneKeyOf(row) {
  const m = row.metadata || {};
  const end = (side) =>
    [
      norm(m[`${side}_state`] || m[`${side}_state_code`]),
      norm(m[`${side}_country_code`] || m[`${side}_country`] || 'ng'),
    ].join('/');
  return `${end('origin')}>${end('destination')}|${norm(row.transport_mode)}`;
}

/** The weight band a bracket covers, as a key two routes can be matched on. */
const bandKeyOf = (b) => `${Number(b?.min ?? 0)}-${Number(b?.max ?? 0)}`;

/**
 * How far apart the figures in a band are.
 *
 * A pair that is merely the wrong way round sits within a factor of two or
 * three of itself — ₦8,000 against ₦11,000. A band holding ₦15,000 and
 * ₦585,000 is not an inverted pair, it is one figure that does not belong in
 * that band at all, and reordering it would move a wrong number rather than
 * fix it. Those are reported and left alone for someone to look at.
 */
const PLAUSIBLE_RATIO = 3;

/**
 * Reorder the prices in one lane so they descend with speed.
 *
 * Nothing is invented: the prices already on the lane are the prices after,
 * dealt out so the fastest service holds the highest of them. The lane keeps
 * exactly the money it had, and a customer stops being offered a slower
 * delivery at a higher price.
 *
 * Each weight band is handled on its own, because a band is what a parcel is
 * actually priced by, and two services on a lane need not carry the same
 * bands.
 *
 * Returns { edits, skipped }: edits are { id, brackets } ready to write,
 * skipped are bands left alone with the reason.
 */
function orderLaneBySpeed(rows) {
  const ranked = rows
    .filter((r) => SPEED[norm(r.service_level)] !== undefined)
    .sort((a, b) => SPEED[norm(a.service_level)] - SPEED[norm(b.service_level)]);
  if (ranked.length < 2) return { edits: [], skipped: [] };

  /* Work on copies, so a band that turns out to be implausible leaves the
     route exactly as it was rather than half-reordered. */
  const next = new Map(
    ranked.map((r) => [
      r.id,
      (Array.isArray(r.weight_brackets) ? r.weight_brackets : []).map((b) => ({ ...b })),
    ]),
  );

  const bands = new Set();
  for (const r of ranked) for (const b of next.get(r.id)) bands.add(bandKeyOf(b));

  const skipped = [];
  let changed = false;

  for (const band of bands) {
    /* The routes that price this band, still fastest first. */
    const here = [];
    for (const r of ranked) {
      const bracket = next.get(r.id).find((b) => bandKeyOf(b) === band);
      if (bracket && Number(bracket.price) > 0) here.push({ row: r, bracket });
    }
    if (here.length < 2) continue;

    const prices = here.map((h) => Number(h.bracket.price));
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    if (hi > lo * PLAUSIBLE_RATIO) {
      skipped.push({
        lane: laneKeyOf(here[0].row),
        band,
        reason: `prices ${lo} and ${hi} are too far apart to be a swapped pair`,
      });
      continue;
    }

    /* Dearest to the fastest. Already in that order → nothing to write. */
    const descending = [...prices].sort((a, b) => b - a);
    if (descending.every((p, i) => p === prices[i])) continue;

    here.forEach((h, i) => {
      const price = descending[i];
      const span = Number(h.bracket.max ?? 0) - Number(h.bracket.min ?? 0);
      h.bracket.price = price;
      /* unit_price is the band's price spread over its weight, and it is read
         on screen beside the price, so it has to move with it. */
      if (h.bracket.unit_price !== undefined && span > 0) {
        h.bracket.unit_price = Number((price / span).toFixed(2));
      }
    });
    changed = true;
  }

  if (!changed) return { edits: [], skipped };

  const edits = [];
  for (const r of ranked) {
    const before = JSON.stringify(r.weight_brackets ?? []);
    const after = JSON.stringify(next.get(r.id));
    if (before !== after) edits.push({ id: r.id, brackets: next.get(r.id) });
  }
  return { edits, skipped };
}

/** Every lane in the table, reordered. */
function orderTableBySpeed(rows) {
  const lanes = new Map();
  for (const r of rows) {
    const key = laneKeyOf(r);
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(r);
  }

  const edits = [];
  const skipped = [];
  for (const lane of lanes.values()) {
    const out = orderLaneBySpeed(lane);
    edits.push(...out.edits);
    skipped.push(...out.skipped);
  }
  return { edits, skipped, lanes: lanes.size };
}

module.exports = { SPEED, laneKeyOf, bandKeyOf, orderLaneBySpeed, orderTableBySpeed, PLAUSIBLE_RATIO };
