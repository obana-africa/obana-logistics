"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add tenant_id column to shippings table
    await queryInterface.addColumn('shippings', 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Tenant ID for API-based shipment creation'
    });

    // Make user_id nullable since shipments can be created via API key (without user)
    await queryInterface.changeColumn('shippings', 'user_id', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // Add index for faster queries
    await queryInterface.addIndex('shippings', ['tenant_id']);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes
    await queryInterface.removeIndex('shippings', ['tenant_id']);
    await queryInterface.removeColumn('shippings', 'tenant_id');
    
    await queryInterface.changeColumn('shippings', 'user_id', {
      type: Sequelize.STRING(50),
      allowNull: false
    });
  }
};
