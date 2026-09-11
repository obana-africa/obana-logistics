'use strict';

// Completes West Africa for the default routes (see 20260911120000-seed-default-route-templates.js):
// Lagos to the ECOWAS members and Mauritania not seeded there. Same prices as the other
// West/Central African capitals; admins adjust them in Routes & pricing. Existing lanes are left alone.

const { LAGOS, svc, routeRows, insertMissingRoutes, removeUneditedRoutes } = require('../seeds/routeSeed');

const SEED = 'default-routes-2026-09';

// Price for up to 10 kg (heavier parcels pro rata) and delivery days.
const SERVICES = [
  svc('air', 'Express', 135000, '4-7'),
  svc('air', 'Economy', 108000, '7-12'),
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

const buildRoutes = () =>
  COUNTRIES.flatMap(([country, countryCode, city, state, stateCode]) =>
    routeRows({
      from: LAGOS,
      to: { city, state, stateCode, country, countryCode },
      services: SERVICES,
      seed: SEED,
      // Priced per country: any city in it uses this route.
      extra: { destination_any_state: true },
    })
  );

module.exports = {
  up: (queryInterface) => insertMissingRoutes(queryInterface, buildRoutes(), 'West Africa routes from Lagos'),

  down: (queryInterface) =>
    removeUneditedRoutes(queryInterface, SEED, "AND metadata->>'destination_country_code' IN (:codes)", {
      codes: COUNTRIES.map((c) => c[1]),
    }),
};
