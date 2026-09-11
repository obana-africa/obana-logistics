module.exports = (sequelize, DataTypes) => {
    // Quotes from the public quote page, saved so a visitor can sign up or sign in and book without
    // losing them. Obana-fleet prices in a quote are honoured at booking until expires_at (24 hours).
    // status is a STRING, not an ENUM, to stay clear of the enum conflicts db.js warns about on sync.
    const Quote = sequelize.define('quotes', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        reference: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        // { city, state, state_code, country, country_code }
        origin: { type: DataTypes.JSONB, allowNull: false },
        destination: { type: DataTypes.JSONB, allowNull: false },
        weight_kg: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NGN' },
        display_currency: { type: DataTypes.STRING(3), allowNull: true },
        // The priced options exactly as the customer saw them (id, provider, mode, service, eta, price).
        options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        // 'quoted' until a shipment is booked from it, then 'booked'.
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'quoted' },
        user_id: { type: DataTypes.INTEGER, allowNull: true },
        shipment_id: { type: DataTypes.INTEGER, allowNull: true },
        expires_at: { type: DataTypes.DATE, allowNull: false }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'quotes'
    })

    return Quote
}
