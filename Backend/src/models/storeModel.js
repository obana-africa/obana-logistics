module.exports = (sequelize, DataTypes) => {
    // A business's connected store (website, Shopify, app…). Owned by a user account; calls the API with its own key.
    // Its shipments are tagged with shippings.tenant_id = stores.id.
    const Store = sequelize.define('stores', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        owner_user_id: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.STRING(120), allowNull: false },
        website_url: { type: DataTypes.STRING(500), allowNull: true },
        // active | paused (key refused until resumed)
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
        // Only a SHA-256 hash of the key is stored; the key itself is shown once.
        api_key_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        api_key_hint: { type: DataTypes.STRING(40), allowNull: false },
        api_key_created_at: { type: DataTypes.DATE, allowNull: true },
        last_used_at: { type: DataTypes.DATE, allowNull: true },
        webhook_url: { type: DataTypes.STRING(500), allowNull: true },
        webhook_secret: { type: DataTypes.STRING(80), allowNull: false },
        metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'stores'
    })

    return Store
}
