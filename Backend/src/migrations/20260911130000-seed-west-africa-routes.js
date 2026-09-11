'use strict';

// Completes West Africa for the default routes (see 20260911120000-seed-default-route-templates.js):
// Lagos to the ECOWAS members and Mauritania not seeded there. Same prices as the other
// West/Central African capitals; admins adjust them in Routes & pricing. Existing lanes are left alone.

const SEED = 'default-routes-2026-09';
const BRACKETS = [[0, 2], [2, 5], [5, 10], [10, 20], [20, 50]];

const SERVICES = [
  { transport_mode: 'air', service_level: 'Express', prices: [45000, 80000, 135000, 230000, 520000], eta: '4-7' },
  { transport_mode: 'air', service_level: 'Economy', prices: [36000, 64000, 108000, 184000, 416000], eta: '7-12' },
];

// [country, code, city, region (as the location picker names it, or the city when it has none), region code]
const COUNTRIES = [
  ['Burkina Faso', 'BF', 'Ouagadougou', 'Centre', '03'],
  ['Mali', 'ML', 'Bamako', 'Bamako', 'BKO'],
  ['Niger', 'NE', 'Niamey', 'Niamey', ''],
  ['Guinea', 'GN', 'Conakry', 'Conakry', 'C'],
  ['Guinea-Bissau', 'GW', 'Bissau', 'Bissau', ''],
  ['Cabo Verde', 'CV', 'Praia', 'Praia', 'PR'],
  ['Mauritania', 'MR', 'Nouakchott', 'Nouakchott-Ouest Region', '13'],
];

const norm = (v) => String(v || '').trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').replace(/ state$/, '');
const place = (m, side) => `${norm(m[`${side}_state`])}@${norm(m[`${side}_country_code`] || m[`${side}_country`])}`;
const laneKey = (r) => `${place(r.metadata || {}, 'origin')}>${place(r.metadata || {}, 'destination')}|${norm(r.transport_mode)}|${norm(r.service_level)}`;

const buildRoutes = () =>
  COUNTRIES.flatMap(([country, code, city, region, regionCode]) =>
    SERVICES.map((s) => ({
      origin_city: 'Lagos',
      destination_city: city,
      transport_mode: s.transport_mode,
      service_level: s.service_level,
      weight_brackets: BRACKETS.map(([min, max], i) => ({
        min, max, price: s.prices[i], eta: `${s.eta} days`, unit_price: Number((s.prices[i] / (max - min)).toFixed(2)),
      })),
      metadata: {
        origin_state: 'Lagos', origin_state_code: 'LA', origin_country: 'Nigeria', origin_country_code: 'NG',
        destination_state: region, destination_state_code: regionCode, destination_country: country, destination_country_code: code,
        // Priced per country: any city in it uses this route.
        destination_any_state: true,
        provider: 'obana',
        seed: SEED,
      },
    }))
  );

module.exports = {
  up: async (queryInterface) => {
    const [existing] = await queryInterface.sequelize.query('SELECT transport_mode, service_level, metadata FROM route_templates');
    const taken = new Set(existing.map(laneKey));
    const now = new Date();
    const rows = buildRoutes()
      .filter((r) => !taken.has(laneKey(r)))
      .map((r) => ({ ...r, weight_brackets: JSON.stringify(r.weight_brackets), metadata: JSON.stringify(r.metadata), created_at: now, updated_at: now }));
    if (rows.length) await queryInterface.bulkInsert('route_templates', rows);
    console.log(`Seeded ${rows.length} West Africa routes.`);
  },

  down: async (queryInterface) => {
    // Only removes these seeded routes, and only if nobody has edited them since.
    await queryInterface.sequelize.query(
      "DELETE FROM route_templates WHERE metadata->>'seed' = :seed AND metadata->>'destination_country_code' IN (:codes) AND updated_at = created_at",
      { replacements: { seed: SEED, codes: COUNTRIES.map((c) => c[1]) } }
    );
  },
};
