'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      agent_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      government_id_type: {
        type: Sequelize.STRING
      },
      government_id_number: {
        type: Sequelize.STRING
      },
      government_id_image: {
        type: Sequelize.STRING
      },
      profile_photo: {
        type: Sequelize.STRING
      },
      verification_status: {
        type: Sequelize.ENUM('pending', 'verified', 'failed'),
        defaultValue: 'pending'
      },
      country: {
        type: Sequelize.STRING
      },
      state: {
        type: Sequelize.STRING
      },
      city: {
        type: Sequelize.STRING
      },
      lga: {
        type: Sequelize.STRING
      },
      assigned_zone: {
        type: Sequelize.STRING
      },
      latitude: {
        type: Sequelize.FLOAT
      },
      longitude: {
        type: Sequelize.FLOAT
      },
      service_radius: {
        type: Sequelize.FLOAT
      },
      status: {
        type: Sequelize.ENUM('pending_verification', 'active', 'suspended', 'deactivated'),
        defaultValue: 'pending_verification'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('agents');
  }
};