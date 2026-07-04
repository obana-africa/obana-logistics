'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Create transport_mode ENUM type if it does not exist
      await queryInterface.sequelize.query(
        `DO $$ BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_shippings_transport_mode') THEN 
            CREATE TYPE public.enum_shippings_transport_mode AS ENUM('road', 'air', 'sea'); 
          END IF; 
        END $$;`,
        { transaction }
      );

      // 2. Create service_level ENUM type if it does not exist
      await queryInterface.sequelize.query(
        `DO $$ BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_shippings_service_level') THEN 
            CREATE TYPE public.enum_shippings_service_level AS ENUM('Express', 'Standard', 'Economy'); 
          END IF; 
        END $$;`,
        { transaction }
      );

      // 3. Add transport_mode column if it does not exist
      const tableInfo = await queryInterface.describeTable('shippings', { transaction });
      
      if (!tableInfo.transport_mode) {
        await queryInterface.addColumn(
          'shippings',
          'transport_mode',
          {
            type: Sequelize.ENUM('road', 'air', 'sea'),
            defaultValue: 'road',
            allowNull: false,
            comment: 'Transportation method for the shipment'
          },
          { transaction }
        );
      }

      // 4. Add service_level column if it does not exist
      if (!tableInfo.service_level) {
        await queryInterface.addColumn(
          'shippings',
          'service_level',
          {
            type: Sequelize.ENUM('Express', 'Standard', 'Economy'),
            defaultValue: 'Standard',
            allowNull: false,
            comment: 'Service level/speed tier'
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableInfo = await queryInterface.describeTable('shippings', { transaction });

      // 1. Remove transport_mode column if it exists
      if (tableInfo.transport_mode) {
        await queryInterface.removeColumn('shippings', 'transport_mode', { transaction });
      }

      // 2. Remove service_level column if it exists
      if (tableInfo.service_level) {
        await queryInterface.removeColumn('shippings', 'service_level', { transaction });
      }

      // 3. Drop ENUM types safely using IF EXISTS
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS public.enum_shippings_transport_mode CASCADE;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS public.enum_shippings_service_level CASCADE;`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
