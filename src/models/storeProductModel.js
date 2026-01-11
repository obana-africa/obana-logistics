module.exports = (sequelize, DataTypes) => {

    const storeProduct = sequelize.define("store_product", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        sku: {
            type: DataTypes.STRING,
            allowNull: false
        },
        image: {
            type: DataTypes.STRING
        },
        general: {
            type: DataTypes.TEXT
        },
        inventry: {
            type: DataTypes.TEXT
        },
        pricing: {
            type: DataTypes.TEXT
        },
        variant: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.TEXT
        },
        store_id: {
            type: DataTypes.INTEGER(11)
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    
    })

    return storeProduct

}