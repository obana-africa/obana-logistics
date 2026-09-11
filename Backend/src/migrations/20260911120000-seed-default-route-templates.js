'use strict';

// Starting routes and prices for Obana's own network: Lagos to every Nigerian state and the FCT, and
// Lagos to major African cities. Each service has one price for up to 10 kg; heavier parcels are charged
// pro rata from it. Prices are NGN estimates from public courier rates in September 2026 (e.g. GIGL
// Lagos → Abuja is about ₦14,500 for 10 kg). Admins adjust them later in Routes & pricing.
//
// Runs on deploy (prestart runs migrations) but only once, and only adds lanes that don't exist
// yet, so a route an admin already priced is never touched.

const { LAGOS, svc, routeRows, insertMissingRoutes, removeUneditedRoutes } = require('../seeds/routeSeed');

const SEED = 'default-routes-2026-09';

// Price for up to 10 kg and delivery days, by distance from Lagos.
const DOMESTIC = {
  // Within Lagos
  lagos: [
    svc('road', 'Standard', 6500, '1-2'),
    svc('road', 'Express', 9000, '0-1'),
  ],
  // South-West neighbours
  near: [
    svc('road', 'Standard', 10500, '1-3'),
    svc('road', 'Express', 14000, '1-2'),
    svc('road', 'Economy', 8500, '3-5'),
  ],
  // South-South, South-East, North-Central and the FCT
  mid: [
    svc('road', 'Standard', 15000, '2-4'),
    svc('road', 'Economy', 12000, '4-7'),
    svc('air', 'Express', 27000, '1-2'),
  ],
  // North-West and North-East
  far: [
    svc('road', 'Standard', 18000, '3-5'),
    svc('road', 'Economy', 14500, '5-8'),
    svc('air', 'Express', 31000, '1-3'),
  ],
};

// [state (as the location picker names it), state code, main city, zone]
const NIGERIA = [
  ['Lagos', 'LA', 'Lagos', 'lagos'],
  ['Ogun', 'OG', 'Abeokuta', 'near'],
  ['Oyo', 'OY', 'Ibadan', 'near'],
  ['Osun', 'OS', 'Osogbo', 'near'],
  ['Ondo', 'ON', 'Akure', 'near'],
  ['Ekiti', 'EK', 'Ado-Ekiti', 'near'],
  ['Edo', 'ED', 'Benin City', 'mid'],
  ['Delta', 'DE', 'Asaba', 'mid'],
  ['Kwara', 'KW', 'Ilorin', 'mid'],
  ['Kogi', 'KO', 'Lokoja', 'mid'],
  ['Abuja Federal Capital Territory', 'FC', 'Abuja', 'mid'],
  ['Niger', 'NI', 'Minna', 'mid'],
  ['Nasarawa', 'NA', 'Lafia', 'mid'],
  ['Benue', 'BE', 'Makurdi', 'mid'],
  ['Plateau', 'PL', 'Jos', 'mid'],
  ['Anambra', 'AN', 'Awka', 'mid'],
  ['Enugu', 'EN', 'Enugu', 'mid'],
  ['Imo', 'IM', 'Owerri', 'mid'],
  ['Abia', 'AB', 'Umuahia', 'mid'],
  ['Ebonyi', 'EB', 'Abakaliki', 'mid'],
  ['Rivers', 'RI', 'Port Harcourt', 'mid'],
  ['Bayelsa', 'BY', 'Yenagoa', 'mid'],
  ['Akwa Ibom', 'AK', 'Uyo', 'mid'],
  ['Cross River', 'CR', 'Calabar', 'mid'],
  ['Kaduna', 'KD', 'Kaduna', 'far'],
  ['Kano', 'KN', 'Kano', 'far'],
  ['Katsina', 'KT', 'Katsina', 'far'],
  ['Jigawa', 'JI', 'Dutse', 'far'],
  ['Bauchi', 'BA', 'Bauchi', 'far'],
  ['Gombe', 'GO', 'Gombe', 'far'],
  ['Adamawa', 'AD', 'Yola', 'far'],
  ['Taraba', 'TA', 'Jalingo', 'far'],
  ['Yobe', 'YO', 'Damaturu', 'far'],
  ['Borno', 'BO', 'Maiduguri', 'far'],
  ['Sokoto', 'SO', 'Sokoto', 'far'],
  ['Zamfara', 'ZA', 'Gusau', 'far'],
  ['Kebbi', 'KE', 'Birnin Kebbi', 'far'],
];

const INTERNATIONAL = {
  // Neighbours along the Lagos–Abidjan corridor: road cargo is common and cheaper.
  westNear: [
    svc('road', 'Standard', 45000, '5-8'),
    svc('air', 'Express', 100000, '3-5'),
  ],
  westCentral: [
    svc('air', 'Express', 135000, '4-7'),
    svc('air', 'Economy', 108000, '7-12'),
  ],
  eastSouthNorth: [
    svc('air', 'Express', 160000, '5-8'),
    svc('air', 'Economy', 128000, '8-14'),
  ],
};

// [country, code, city, region (as the location picker names it), region code, zone]
const AFRICA = [
  ['Ghana', 'GH', 'Accra', 'Greater Accra', 'AA', 'westNear'],
  ['Togo', 'TG', 'Lomé', 'Maritime', 'M', 'westNear'],
  ['Benin', 'BJ', 'Cotonou', 'Littoral Department', 'LI', 'westNear'],
  ["Côte d'Ivoire", 'CI', 'Abidjan', 'Abidjan', 'AB', 'westNear'],
  ['Senegal', 'SN', 'Dakar', 'Dakar', 'DK', 'westCentral'],
  ['Sierra Leone', 'SL', 'Freetown', 'Western Area', 'W', 'westCentral'],
  ['Liberia', 'LR', 'Monrovia', 'Montserrado County', 'MO', 'westCentral'],
  ['Gambia', 'GM', 'Banjul', 'Banjul', 'B', 'westCentral'],
  ['Cameroon', 'CM', 'Douala', 'Littoral', 'LT', 'westCentral'],
  ['Gabon', 'GA', 'Libreville', 'Estuaire Province', '1', 'westCentral'],
  ['Democratic Republic of the Congo', 'CD', 'Kinshasa', 'Kinshasa', 'KN', 'westCentral'],
  ['Kenya', 'KE', 'Nairobi', 'Nairobi City', '30', 'eastSouthNorth'],
  ['Uganda', 'UG', 'Kampala', 'Central Region', 'C', 'eastSouthNorth'],
  ['Rwanda', 'RW', 'Kigali', 'Kigali district', '01', 'eastSouthNorth'],
  ['Tanzania', 'TZ', 'Dar es Salaam', 'Dar es Salaam', '02', 'eastSouthNorth'],
  ['Ethiopia', 'ET', 'Addis Ababa', 'Addis Ababa', 'AA', 'eastSouthNorth'],
  ['South Africa', 'ZA', 'Johannesburg', 'Gauteng', 'GP', 'eastSouthNorth'],
  ['Egypt', 'EG', 'Cairo', 'Cairo', 'C', 'eastSouthNorth'],
  ['Morocco', 'MA', 'Casablanca', 'Casablanca-Settat', '06', 'eastSouthNorth'],
  ['Zambia', 'ZM', 'Lusaka', 'Lusaka Province', '09', 'eastSouthNorth'],
];

const buildRoutes = () => [
  ...NIGERIA.flatMap(([state, stateCode, city, zone]) =>
    routeRows({
      from: LAGOS,
      to: { city, state, stateCode, country: 'Nigeria', countryCode: 'NG' },
      services: DOMESTIC[zone],
      seed: SEED,
      // Same price back to Lagos until an admin sets a return route.
      extra: { bidirectional: true },
    })
  ),
  ...AFRICA.flatMap(([country, countryCode, city, state, stateCode, zone]) =>
    routeRows({
      from: LAGOS,
      to: { city, state, stateCode, country, countryCode },
      services: INTERNATIONAL[zone],
      seed: SEED,
      // Priced per country: any city in it uses this route.
      extra: { destination_any_state: true },
    })
  ),
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Fresh databases: the app creates this table on first boot, but migrations run before that.
    const exists = await queryInterface.describeTable('route_templates').then(() => true, () => false);
    if (!exists) {
      await queryInterface.createTable('route_templates', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        origin_city: { type: Sequelize.STRING, allowNull: false },
        destination_city: { type: Sequelize.STRING, allowNull: false },
        transport_mode: { type: Sequelize.STRING, allowNull: false },
        service_level: { type: Sequelize.STRING, allowNull: false },
        weight_brackets: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        preferred_driver_id: { type: Sequelize.INTEGER, allowNull: true },
        zoho_item_id: { type: Sequelize.STRING, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }
    await insertMissingRoutes(queryInterface, buildRoutes(), 'Default routes from Lagos');
  },

  down: (queryInterface) =>
    removeUneditedRoutes(queryInterface, SEED, "AND metadata->>'origin_state' = 'Lagos'"),
};
