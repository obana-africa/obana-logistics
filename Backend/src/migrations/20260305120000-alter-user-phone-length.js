'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // increase phone field length to 50 characters to accommodate country codes
    await queryInterface.changeColumn('users', 'phone', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // revert back to 20 chars
    await queryInterface.changeColumn('users', 'phone', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  }
};