module.exports = (sequelize, DataTypes) => {
    // One webhook event sent (or being retried) to a store's webhook_url.
    const StoreWebhookDelivery = sequelize.define('store_webhook_deliveries', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        store_id: { type: DataTypes.INTEGER, allowNull: false },
        shipment_id: { type: DataTypes.INTEGER, allowNull: true },
        event: { type: DataTypes.STRING(60), allowNull: false },
        payload: { type: DataTypes.JSONB, allowNull: false },
        // pending (waiting for a retry) | delivered | failed (gave up)
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
        attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        response_code: { type: DataTypes.INTEGER, allowNull: true },
        response_body: { type: DataTypes.STRING(500), allowNull: true },
        next_attempt_at: { type: DataTypes.DATE, allowNull: true },
        delivered_at: { type: DataTypes.DATE, allowNull: true }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'store_webhook_deliveries'
    })

    return StoreWebhookDelivery
}
