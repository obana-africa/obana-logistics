'use strict';

// Starting routes and prices for Obana's own network: Lagos to every Nigerian state and the FCT, and
// Lagos to major African cities. Prices are NGN estimates from public courier rates in September 2026
// (e.g. GIGL Lagos → Abuja is about ₦7,500 for 2 kg, ₦10,000 for 5 kg, plus ~₦700 for home delivery).
// Admins adjust them later in Routes & pricing.
//
// Runs on every deploy (prestart runs migrations) but only once, and only adds lanes that don't exist
// yet, so a route an admin already priced is never touched.

const SEED = 'default-routes-2026-09';

// Weight brackets in kg. Heavier parcels are priced up from the 50 kg bracket (see priceTemplate).
const BRACKETS = [[0, 2], [2, 5], [5, 10], [10, 20], [20, 50]];

// Price per bracket (2, 5, 10, 20, 50 kg) and delivery days for each service on a lane.
const svc = (transport_mode, service_level, prices, eta) => ({ transport_mode, service_level, prices, eta });

const DOMESTIC = {
  // Within Lagos
  lagos: [
    svc('road', 'Standard', [3500, 4500, 6500, 10000, 20000], '1-2'),
    svc('road', 'Express', [5000, 6500, 9000, 14000, 28000], '0-1'),
  ],
  // South-West neighbours
  near: [
    svc('road', 'Standard', [5500, 7500, 10500, 17000, 34000], '1-3'),
    svc('road', 'Express', [7500, 10000, 14000, 22500, 45000], '1-2'),
    svc('road', 'Economy', [4500, 6000, 8500, 13500, 27000], '3-5'),
  ],
  // South-South, South-East, North-Central and the FCT
  mid: [
    svc('road', 'Standard', [8000, 10500, 15000, 24000, 48000], '2-4'),
    svc('road', 'Economy', [6500, 8500, 12000, 19000, 38500], '4-7'),
    svc('air', 'Express', [12000, 17000, 27000, 45000, 95000], '1-2'),
  ],
  // North-West and North-East
  far: [
    svc('road', 'Standard', [9500, 12500, 18000, 29000, 58000], '3-5'),
    svc('road', 'Economy', [7500, 10000, 14500, 23000, 46500], '5-8'),
    svc('air', 'Express', [14000, 20000, 31000, 52000, 110000], '1-3'),
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
    svc('road', 'Standard', [18000, 28000, 45000, 75000, 160000], '5-8'),
    svc('air', 'Express', [35000, 60000, 100000, 170000, 380000], '3-5'),
  ],
  westCentral: [
    svc('air', 'Express', [45000, 80000, 135000, 230000, 520000], '4-7'),
    svc('air', 'Economy', [36000, 64000, 108000, 184000, 416000], '7-12'),
  ],
  eastSouthNorth: [
    svc('air', 'Express', [55000, 95000, 160000, 280000, 640000], '5-8'),
    svc('air', 'Economy', [44000, 76000, 128000, 224000, 512000], '8-14'),
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

const LAGOS = { origin_state: 'Lagos', origin_state_code: 'LA', origin_country: 'Nigeria', origin_country_code: 'NG' };

const brackets = (prices, eta) =>
  BRACKETS.map(([min, max], i) => ({ min, max, price: prices[i], eta: `${eta} days`, unit_price: Number((prices[i] / (max - min)).toFixed(2)) }));

const buildRoutes = () => {
  const routes = [];
  for (const [state, stateCode, city, zone] of NIGERIA) {
    for (const s of DOMESTIC[zone]) {
      routes.push({
        origin_city: 'Lagos',
        destination_city: city,
        transport_mode: s.transport_mode,
        service_level: s.service_level,
        weight_brackets: brackets(s.prices, s.eta),
        metadata: {
          ...LAGOS,
          destination_state: state,
          destination_state_code: stateCode,
          destination_country: 'Nigeria',
          destination_country_code: 'NG',
          // Same price back to Lagos until an admin sets a return route.
          bidirectional: true,
          provider: 'obana',
          seed: SEED,
        },
      });
    }
  }
  for (const [country, code, city, region, regionCode, zone] of AFRICA) {
    for (const s of INTERNATIONAL[zone]) {
      routes.push({
        origin_city: 'Lagos',
        destination_city: city,
        transport_mode: s.transport_mode,
        service_level: s.service_level,
        weight_brackets: brackets(s.prices, s.eta),
        metadata: {
          ...LAGOS,
          destination_state: region,
          destination_state_code: regionCode,
          destination_country: country,
          destination_country_code: code,
          // Priced per country: any city in it uses this route.
          destination_any_state: true,
          provider: 'obana',
          seed: SEED,
        },
      });
    }
  }
  return routes;
};

// Same normalising as routesController, so "Lagos State" and "Lagos" count as one lane.
const norm = (v) => String(v || '').trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').replace(/ state$/, '');
const place = (m, side) => `${norm(m[`${side}_state`])}@${norm(m[`${side}_country_code`] || m[`${side}_country`])}`;
const laneKey = (r) => {
  const m = r.metadata || {};
  return `${place(m, 'origin')}>${place(m, 'destination')}|${norm(r.transport_mode)}|${norm(r.service_level)}`;
};

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

    const [existing] = await queryInterface.sequelize.query('SELECT transport_mode, service_level, metadata FROM route_templates');
    const taken = new Set(existing.map(laneKey));
    const now = new Date();
    const rows = buildRoutes()
      .filter((r) => !taken.has(laneKey(r)))
      .map((r) => ({
        ...r,
        weight_brackets: JSON.stringify(r.weight_brackets),
        metadata: JSON.stringify(r.metadata),
        created_at: now,
        updated_at: now,
      }));
    if (rows.length) await queryInterface.bulkInsert('route_templates', rows);
    console.log(`Seeded ${rows.length} default routes (${existing.length} routes already existed).`);
  },

  down: async (queryInterface) => {
    // Only removes seeded routes nobody has edited since.
    await queryInterface.sequelize.query(
      "DELETE FROM route_templates WHERE metadata->>'seed' = :seed AND updated_at = created_at",
      { replacements: { seed: SEED } }
    );
  },
};
