'use strict';

/**
 * Applying the 2026 price table to the routes already in the database.
 *
 * Separate from the migration so it can be read, tested and dry-run without
 * one — the same split routeUplift uses, and the reason the audit script can
 * show what the migration would do before it does it.
 */

const { rateFor, tierFor } = require('./pricing2026');

/** The zone each state belongs to, as the seed that built the table named them. */
const STATE_ZONE = {
    lagos: 'SW', ogun: 'SW', oyo: 'SW', osun: 'SW', ondo: 'SW', ekiti: 'SW',
    edo: 'SS', delta: 'SS', rivers: 'SS', bayelsa: 'SS', 'akwa ibom': 'SS', 'cross river': 'SS',
    anambra: 'SE', enugu: 'SE', imo: 'SE', abia: 'SE', ebonyi: 'SE',
    kwara: 'NC', kogi: 'NC', 'abuja federal capital territory': 'NC', niger: 'NC',
    nasarawa: 'NC', benue: 'NC', plateau: 'NC',
    kaduna: 'NW', kano: 'NW', katsina: 'NW', jigawa: 'NW', sokoto: 'NW', zamfara: 'NW', kebbi: 'NW',
    bauchi: 'NE', gombe: 'NE', adamawa: 'NE', taraba: 'NE', yobe: 'NE', borno: 'NE',
};

/**
 * A state name reduced to the one form this table is keyed on.
 *
 * Deliberately the same reduction the quote engine's normalizeState does —
 * lower case, hyphens and underscores to spaces, runs of space collapsed, a
 * trailing "state" dropped — because a row the ENGINE happily matches as
 * Lagos and this file does not is a row that keeps its old price while every
 * lane around it moves, and says nothing about it.
 *
 * Found by running the migration against a row spelled "Lagos State", which
 * it skipped.
 */
const norm = (v) =>
    String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/ state$/, '')
        .trim();

/* The spellings that reach this table from elsewhere. The location picker and
   Obana's own routes name the capital "Abuja Federal Capital Territory"; a
   hand-typed lane says "FCT" or "Abuja", and a lane nobody can classify is a
   lane this must leave alone rather than price as a guess. */
const ALIAS = {
    fct: 'abuja federal capital territory',
    abuja: 'abuja federal capital territory',
    'fct abuja': 'abuja federal capital territory',
    'abuja fct': 'abuja federal capital territory',
    'federal capital territory': 'abuja federal capital territory',
    nassarawa: 'nasarawa',
};

const stateKey = (name) => {
    const n = norm(name);
    return ALIAS[n] ?? n;
};

const zoneOf = (name) => STATE_ZONE[stateKey(name)] ?? null;

/** Nigeria, however the row spells it. Anything else is not ours to reprice. */
const isNigeria = (country) => {
    const n = norm(country);
    return n === '' || n === 'ng' || n === 'nigeria';
};

/**
 * Which lane a route row is, from its metadata.
 *
 * Returns null for anything this table does not cover: an international lane,
 * a state it does not recognise, a row with no origin or destination. Those
 * keep whatever price they have — an Italy lane is priced by an agreement,
 * not by a zone gap, and guessing at it would be worse than leaving it.
 */
function laneOf(row) {
    const m = row.metadata || {};
    if (!isNigeria(m.origin_country_code ?? m.origin_country)) return null;
    if (!isNigeria(m.destination_country_code ?? m.destination_country)) return null;

    const from = stateKey(m.origin_state);
    const to = stateKey(m.destination_state);
    const originZone = zoneOf(from);
    const destinationZone = zoneOf(to);
    if (!originZone || !destinationZone) return null;

    return { sameState: from === to, originZone, destinationZone, from, to };
}

/**
 * The repriced weight brackets for one route, or null to leave it alone.
 *
 * Only the parcel band is repriced — the band the table is about. A lane
 * carrying a negotiated heavy bracket (Lagos → Port Harcourt has ₦585,000
 * from 50 kg, agreed for one job) keeps it: this is a price list for parcels,
 * and a figure somebody agreed for a truck is not in it.
 */
function repriceRoute(row, { parcelMaxKg = 10 } = {}) {
    const lane = laneOf(row);
    if (!lane) return null;

    const rate = rateFor(lane, row.transport_mode, row.service_level);
    if (!rate) return null;

    const brackets = Array.isArray(row.weight_brackets) ? row.weight_brackets : [];
    if (brackets.length === 0) return null;

    let changed = false;
    const next = brackets.map((b) => {
        const max = Number(b?.max ?? 0);
        // The parcel band and nothing else.
        if (!(max > 0 && max <= parcelMaxKg)) return { ...b };
        const min = Number(b?.min ?? 0);
        const span = max - min;
        const priced = {
            ...b,
            price: rate.price,
            eta: `${rate.eta} days`,
            ...(b.unit_price !== undefined && span > 0
                ? { unit_price: Number((rate.price / span).toFixed(2)) }
                : {}),
        };
        if (priced.price !== b.price || priced.eta !== b.eta) changed = true;
        return priced;
    });

    return changed ? { id: row.id, lane, rate, brackets: next } : null;
}

/** Every route in the table, repriced. Rows it does not cover are counted. */
function repriceTable(rows, options) {
    const edits = [];
    const skipped = [];
    for (const row of rows) {
        const lane = laneOf(row);
        if (!lane) {
            skipped.push({ id: row.id, reason: 'not a Nigerian lane this table prices' });
            continue;
        }
        if (!rateFor(lane, row.transport_mode, row.service_level)) {
            skipped.push({
                id: row.id,
                reason: `tier ${tierFor(lane)} does not sell ${row.transport_mode} ${row.service_level}`,
            });
            continue;
        }
        const edit = repriceRoute(row, options);
        if (edit) edits.push(edit);
    }
    return { edits, skipped };
}

module.exports = { STATE_ZONE, laneOf, zoneOf, stateKey, repriceRoute, repriceTable };
