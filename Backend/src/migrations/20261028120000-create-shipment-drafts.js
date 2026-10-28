'use strict';

/**
 * Bookings somebody started and has not finished.
 *
 * A draft is a half-filled form, so the column holding it is JSON and nothing
 * in it is validated: the rules a shipment must satisfy are rules about a
 * finished shipment. Only the owner and the time are structured, because those
 * are the only things a list needs to show and the only things a query filters
 * on.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('shipment_drafts', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
            user_id: { type: Sequelize.INTEGER, allowNull: false },
            label: { type: Sequelize.STRING, allowNull: true },
            form: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        /* The only way this table is ever read: this person's drafts, newest
           first. */
        await queryInterface.addIndex('shipment_drafts', ['user_id', 'updated_at'], {
            name: 'shipment_drafts_user_updated',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('shipment_drafts');
    },
};
