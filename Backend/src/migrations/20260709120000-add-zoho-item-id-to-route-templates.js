module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('route_templates', 'zoho_item_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('route_templates', 'zoho_item_id');
  }
};
