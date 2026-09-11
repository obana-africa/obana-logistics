'use strict';

// Import routes into Lagos from where customers ship most: the UK, Europe, North America, China, India,
// the Gulf and Turkey (Africa, both ways, is in the next migration). Routes are priced per origin
// country, so any state or city the customer picks in that country uses its country's route, delivered
// anywhere in Lagos.
//
// Air prices cover up to 10 kg and sea up to 100 kg; heavier loads are charged pro rata. They are NGN
// estimates from forwarder rates in September 2026 (converted at about ₦1,820/£, ₦1,565/€ and ₦1,325/$):
// consolidated air is about $5–8/kg plus ~$30 handling (UK about £5/kg), express courier about
// $16.50/kg. Admins adjust them in Routes & pricing.

const { LAGOS, SEA_BAND, svc, routeRows, insertMissingRoutes, removeUneditedRoutes } = require('../seeds/routeSeed');

const SEED = 'import-routes-2026-09';

// Services by origin region: air Express (courier), air Standard (consolidated cargo), sea Economy.
const REGIONS = {
  uk: [
    svc('air', 'Express', 300000, '3-5'),
    svc('air', 'Standard', 118000, '7-10'),
    svc('sea', 'Economy', 310000, '35-50', SEA_BAND),
  ],
  europe: [
    svc('air', 'Express', 320000, '3-5'),
    svc('air', 'Standard', 125000, '7-12'),
    svc('sea', 'Economy', 330000, '35-55', SEA_BAND),
  ],
  northAmerica: [
    svc('air', 'Express', 320000, '3-5'),
    svc('air', 'Standard', 120000, '7-12'),
    svc('sea', 'Economy', 360000, '40-60', SEA_BAND),
  ],
  china: [
    svc('air', 'Express', 340000, '4-6'),
    svc('air', 'Standard', 145000, '10-14'),
    svc('sea', 'Economy', 290000, '45-65', SEA_BAND),
  ],
  india: [
    svc('air', 'Express', 340000, '4-6'),
    svc('air', 'Standard', 115000, '7-12'),
    svc('sea', 'Economy', 270000, '30-45', SEA_BAND),
  ],
  gulf: [
    svc('air', 'Express', 285000, '3-5'),
    svc('air', 'Standard', 100000, '5-9'),
    svc('sea', 'Economy', 270000, '25-40', SEA_BAND),
  ],
};

// [country, code, main city, region (as the location picker names it), region code, pricing region]
const ORIGINS = [
  ['United Kingdom', 'GB', 'London', 'England', 'ENG', 'uk'],

  ['Germany', 'DE', 'Frankfurt am Main', 'Hesse', 'HE', 'europe'],
  ['France', 'FR', 'Paris', 'Île-de-France', 'IDF', 'europe'],
  ['Netherlands', 'NL', 'Amsterdam', 'North Holland', 'NH', 'europe'],
  ['Belgium', 'BE', 'Brussels', 'Brussels-Capital Region', 'BRU', 'europe'],
  ['Ireland', 'IE', 'Dublin', 'Leinster', 'L', 'europe'],
  ['Italy', 'IT', 'Milan', 'Lombardy', '25', 'europe'],
  ['Spain', 'ES', 'Madrid', 'Madrid', 'MD', 'europe'],
  ['Switzerland', 'CH', 'Zürich', 'Zürich', 'ZH', 'europe'],
  ['Sweden', 'SE', 'Stockholm', 'Stockholm County', 'AB', 'europe'],
  ['Norway', 'NO', 'Oslo', 'Oslo', '03', 'europe'],
  ['Denmark', 'DK', 'Copenhagen', 'Capital Region of Denmark', '84', 'europe'],
  ['Poland', 'PL', 'Warsaw', 'Masovian Voivodeship', 'MZ', 'europe'],

  ['United States', 'US', 'Houston', 'Texas', 'TX', 'northAmerica'],
  ['Canada', 'CA', 'Toronto', 'Ontario', 'ON', 'northAmerica'],

  ['China', 'CN', 'Guangzhou', 'Guangdong', 'GD', 'china'],
  ['India', 'IN', 'Mumbai', 'Maharashtra', 'MH', 'india'],

  ['United Arab Emirates', 'AE', 'Dubai', 'Dubai', 'DU', 'gulf'],
  ['Saudi Arabia', 'SA', 'Riyadh', 'Riyadh', '01', 'gulf'],
  ['Turkey', 'TR', 'Istanbul', 'Istanbul', '34', 'gulf'],
];

const buildRoutes = () =>
  ORIGINS.flatMap(([country, countryCode, city, state, stateCode, region]) =>
    routeRows({
      from: { city, state, stateCode, country, countryCode },
      to: LAGOS,
      services: REGIONS[region],
      seed: SEED,
      // Priced per country: any state or city in it uses this route.
      extra: { origin_any_state: true },
    })
  );

module.exports = {
  up: (queryInterface) => insertMissingRoutes(queryInterface, buildRoutes(), 'Import routes to Lagos'),

  down: (queryInterface) => removeUneditedRoutes(queryInterface, SEED),
};
