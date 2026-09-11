'use strict';

// Africa both ways: Lagos → each African country and back to Lagos, for 41 countries. Routes are priced
// per country, so any state or city the customer picks there uses its country's route. Imports use the
// same prices as exports until an admin sets them apart in Routes & pricing.
//
// Lanes the earlier migrations already created (Lagos → 27 of these countries) are skipped, so this adds
// the return routes for those plus both directions for the rest.

const { LAGOS, svc, routeRows, insertMissingRoutes, removeUneditedRoutes } = require('../seeds/routeSeed');

const SEED = 'africa-routes-2026-09';

// Price for up to 10 kg (heavier parcels pro rata) and delivery days, by distance from Lagos.
const ZONES = {
  // Neighbours along the Lagos–Abidjan corridor: road cargo is common and cheaper.
  westNear: [
    svc('road', 'Standard', 45000, '5-8'),
    svc('air', 'Express', 100000, '3-5'),
  ],
  // The rest of West Africa and Central Africa.
  westCentral: [
    svc('air', 'Express', 135000, '4-7'),
    svc('air', 'Economy', 108000, '7-12'),
  ],
  // East, Southern and North Africa.
  eastSouthNorth: [
    svc('air', 'Express', 160000, '5-8'),
    svc('air', 'Economy', 128000, '8-14'),
  ],
};

// [country, code, main city, region (as the location picker names it, or the city when it has none), region code, zone]
// Regions match the earlier migrations exactly, so their Lagos → country lanes are recognised and skipped.
const AFRICA = [
  // West Africa, near
  ['Ghana', 'GH', 'Accra', 'Greater Accra', 'AA', 'westNear'],
  ['Togo', 'TG', 'Lomé', 'Maritime', 'M', 'westNear'],
  ['Benin', 'BJ', 'Cotonou', 'Littoral Department', 'LI', 'westNear'],
  ["Côte d'Ivoire", 'CI', 'Abidjan', 'Abidjan', 'AB', 'westNear'],

  // West Africa
  ['Senegal', 'SN', 'Dakar', 'Dakar', 'DK', 'westCentral'],
  ['Sierra Leone', 'SL', 'Freetown', 'Western Area', 'W', 'westCentral'],
  ['Liberia', 'LR', 'Monrovia', 'Montserrado County', 'MO', 'westCentral'],
  ['Gambia', 'GM', 'Banjul', 'Banjul', 'B', 'westCentral'],
  ['Burkina Faso', 'BF', 'Ouagadougou', 'Centre', '03', 'westCentral'],
  ['Mali', 'ML', 'Bamako', 'Bamako', 'BKO', 'westCentral'],
  ['Niger', 'NE', 'Niamey', 'Niamey', '', 'westCentral'],
  ['Guinea', 'GN', 'Conakry', 'Conakry', 'C', 'westCentral'],
  ['Guinea-Bissau', 'GW', 'Bissau', 'Bissau', '', 'westCentral'],
  ['Cabo Verde', 'CV', 'Praia', 'Praia', 'PR', 'westCentral'],
  ['Mauritania', 'MR', 'Nouakchott', 'Nouakchott-Ouest Region', '13', 'westCentral'],

  // Central Africa
  ['Cameroon', 'CM', 'Douala', 'Littoral', 'LT', 'westCentral'],
  ['Gabon', 'GA', 'Libreville', 'Estuaire Province', '1', 'westCentral'],
  ['Democratic Republic of the Congo', 'CD', 'Kinshasa', 'Kinshasa', 'KN', 'westCentral'],
  ['Republic of the Congo', 'CG', 'Brazzaville', 'Brazzaville', 'BZV', 'westCentral'],
  ['Equatorial Guinea', 'GQ', 'Malabo', 'Bioko Norte Province', 'BN', 'westCentral'],
  ['Chad', 'TD', "N'Djamena", "N'Djamena", '', 'westCentral'],

  // East Africa
  ['Kenya', 'KE', 'Nairobi', 'Nairobi City', '30', 'eastSouthNorth'],
  ['Uganda', 'UG', 'Kampala', 'Central Region', 'C', 'eastSouthNorth'],
  ['Rwanda', 'RW', 'Kigali', 'Kigali district', '01', 'eastSouthNorth'],
  ['Tanzania', 'TZ', 'Dar es Salaam', 'Dar es Salaam', '02', 'eastSouthNorth'],
  ['Ethiopia', 'ET', 'Addis Ababa', 'Addis Ababa', 'AA', 'eastSouthNorth'],
  ['Burundi', 'BI', 'Bujumbura', 'Bujumbura Mairie Province', 'BM', 'eastSouthNorth'],
  ['Madagascar', 'MG', 'Antananarivo', 'Antananarivo Province', 'T', 'eastSouthNorth'],
  ['Mauritius', 'MU', 'Port Louis', 'Port Louis District', 'PL', 'eastSouthNorth'],

  // Southern Africa
  ['South Africa', 'ZA', 'Johannesburg', 'Gauteng', 'GP', 'eastSouthNorth'],
  ['Zambia', 'ZM', 'Lusaka', 'Lusaka Province', '09', 'eastSouthNorth'],
  ['Angola', 'AO', 'Luanda', 'Luanda Province', 'LUA', 'eastSouthNorth'],
  ['Mozambique', 'MZ', 'Maputo', 'Maputo', 'MPM', 'eastSouthNorth'],
  ['Zimbabwe', 'ZW', 'Harare', 'Harare Province', 'HA', 'eastSouthNorth'],
  ['Botswana', 'BW', 'Gaborone', 'South-East District', 'SE', 'eastSouthNorth'],
  ['Namibia', 'NA', 'Windhoek', 'Khomas Region', 'KH', 'eastSouthNorth'],
  ['Malawi', 'MW', 'Lilongwe', 'Central Region', 'C', 'eastSouthNorth'],

  // North Africa
  ['Egypt', 'EG', 'Cairo', 'Cairo', 'C', 'eastSouthNorth'],
  ['Morocco', 'MA', 'Casablanca', 'Casablanca-Settat', '06', 'eastSouthNorth'],
  ['Algeria', 'DZ', 'Algiers', 'Algiers', '16', 'eastSouthNorth'],
  ['Tunisia', 'TN', 'Tunis', 'Tunis Governorate', '11', 'eastSouthNorth'],
];

const buildRoutes = () =>
  AFRICA.flatMap(([country, countryCode, city, state, stateCode, zone]) => {
    const abroad = { city, state, stateCode, country, countryCode };
    return [
      // Priced per country: any state or city there uses these routes.
      ...routeRows({ from: LAGOS, to: abroad, services: ZONES[zone], seed: SEED, extra: { destination_any_state: true } }),
      ...routeRows({ from: abroad, to: LAGOS, services: ZONES[zone], seed: SEED, extra: { origin_any_state: true } }),
    ];
  });

module.exports = {
  up: (queryInterface) => insertMissingRoutes(queryInterface, buildRoutes(), 'Africa routes, both ways'),

  down: (queryInterface) => removeUneditedRoutes(queryInterface, SEED),
};
