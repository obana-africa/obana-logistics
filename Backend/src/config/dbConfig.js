module.exports = {

    HOST: process.env.DB_HOST,
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASSWORD,
    DB: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT,
    PORT: process.env.DB_PORT ?? 5433,

    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 1000
    },

   
   

}

