module.exports = (sequelize, DataTypes) => {
    const Agent = sequelize.define("agents", {
        agent_code: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        government_id_type: DataTypes.STRING,
        government_id_number: DataTypes.STRING,
        government_id_image: DataTypes.STRING,
        profile_photo: DataTypes.STRING,
        verification_status: {
            type: DataTypes.ENUM('pending', 'verified', 'failed'),
            defaultValue: 'pending'
        },
        country: DataTypes.STRING,
        state: DataTypes.STRING,
        city: DataTypes.STRING,
        lga: DataTypes.STRING,
        assigned_zone: DataTypes.STRING,
        latitude: DataTypes.FLOAT,
        longitude: DataTypes.FLOAT,
        service_radius: DataTypes.FLOAT, // in km
        status: DataTypes.ENUM('pending_verification', 'active', 'suspended', 'deactivated')
    });
    return Agent;
};