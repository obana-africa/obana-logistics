'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('route_templates', 'preferred_driver_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow null initially, or set a default if appropriate
      references: {
        model: 'drivers', // Name of the drivers table
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Set to null if the referenced driver is deleted
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('route_templates', 'preferred_driver_id');
  }
};