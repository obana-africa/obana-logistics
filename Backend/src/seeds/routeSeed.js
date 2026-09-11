// Helpers for the route-seeding migrations: turn price tables into route_templates rows and insert only
// lanes that don't exist yet. Migrations that already ran depend on this behaviour, so keep it stable.

// One weight band per service. Its price covers any parcel up to the band's max weight; heavier parcels
// are charged pro rata from it (price ÷ max for each extra kg, see priceTemplate in routesController).
// Only add bands when delivery time changes with weight.
const PARCEL_BAND = [0, 10];
// Sea freight is sold by the bigger load.
const SEA_BAND = [0, 100];

/** A service on a lane: the NGN price for its weight band and a delivery estimate in days ("3-5"). */
const svc = (transport_mode, service_level, price, eta, band = PARCEL_BAND) => ({ transport_mode, service_level, price, eta, band });

const brackets = ({ price, eta, band: [min, max] }) => [
  { min, max, price, eta: `${eta} days`, unit_price: Number((price / (max - min)).toFixed(2)) },
];

/** A place as the location picker names it: { city, state, stateCode, country, countryCode }. */
const LAGOS = { city: 'Lagos', state: 'Lagos', stateCode: 'LA', country: 'Nigeria', countryCode: 'NG' };

/** One route per service between two places. `extra` goes into metadata (e.g. bidirectional, *_any_state). */
const routeRows = ({ from, to, services, seed, extra = {} }) =>
  services.map((s) => ({
    origin_city: from.city,
    destination_city: to.city,
    transport_mode: s.transport_mode,
    service_level: s.service_level,
    weight_brackets: brackets(s),
    metadata: {
      origin_state: from.state,
      origin_state_code: from.stateCode,
      origin_country: from.country,
      origin_country_code: from.countryCode,
      destination_state: to.state,
      destination_state_code: to.stateCode,
      destination_country: to.country,
      destination_country_code: to.countryCode,
      provider: 'obana',
      seed,
      ...extra,
    },
  }));

// Same normalising as routesController, so "Lagos State" and "Lagos" count as the same lane.
const norm = (v) => String(v || '').trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').replace(/ state$/, '');
const place = (m, side) => `${norm(m[`${side}_state`])}@${norm(m[`${side}_country_code`] || m[`${side}_country`])}`;
const laneKey = (r) => {
  const m = r.metadata || {};
  return `${place(m, 'origin')}>${place(m, 'destination')}|${norm(r.transport_mode)}|${norm(r.service_level)}`;
};

/** Insert the routes whose lane (origin, destination, mode, service) isn't in the table yet. */
const insertMissingRoutes = async (queryInterface, routes, label) => {
  const [existing] = await queryInterface.sequelize.query('SELECT transport_mode, service_level, metadata FROM route_templates');
  const taken = new Set(existing.map(laneKey));
  const now = new Date();
  const rows = routes
    .filter((r) => !taken.has(laneKey(r)))
    .map((r) => ({ ...r, weight_brackets: JSON.stringify(r.weight_brackets), metadata: JSON.stringify(r.metadata), created_at: now, updated_at: now }));
  if (rows.length) await queryInterface.bulkInsert('route_templates', rows);
  console.log(`${label}: added ${rows.length} of ${routes.length} routes (the rest already existed).`);
  return rows;
};

/** Undo a seed: remove its routes that nobody has edited since (an admin edit bumps updated_at). */
const removeUneditedRoutes = (queryInterface, seed, where = '', replacements = {}) =>
  queryInterface.sequelize.query(
    `DELETE FROM route_templates WHERE metadata->>'seed' = :seed AND updated_at = created_at ${where}`,
    { replacements: { seed, ...replacements } }
  );

module.exports = { PARCEL_BAND, SEA_BAND, LAGOS, svc, routeRows, laneKey, insertMissingRoutes, removeUneditedRoutes };
