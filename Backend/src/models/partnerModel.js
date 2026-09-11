module.exports = (sequelize, DataTypes) => {
    // Partner carriers Obana resells (added automatically when a quote returns their rates) and the markup on them.
    // One row with kind 'default' holds the default markup for partners without their own.
    // kind is a STRING, not an ENUM, to stay clear of the enum conflicts db.js warns about on sync.
    const Partner = sequelize.define('partners', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        slug: { type: DataTypes.STRING, allowNull: false, unique: true },
        name: { type: DataTypes.STRING, allowNull: false },
        kind: { type: DataTypes.STRING, allowNull: false, defaultValue: 'carrier' },
        logo_url: { type: DataTypes.STRING(1024), allowNull: true },
        enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        // null = use the default markup
        markup_percent: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
        last_seen_at: { type: DataTypes.DATE, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'partners'
    })

    return Partner
}
