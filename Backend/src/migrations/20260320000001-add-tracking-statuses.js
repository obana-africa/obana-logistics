'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      // Add 'picked_up' status to tracking enum
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_shipment_trackings_status" ADD VALUE IF NOT EXISTS 'picked_up';
      `, { transaction: t });
      
      // Add 'dispatched' status to tracking enum
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_shipment_trackings_status" ADD VALUE IF NOT EXISTS 'dispatched';
      `, { transaction: t });
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverting ENUM additions in Postgres is complex and generally skipped
  }
};