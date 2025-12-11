const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ged_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test de connexion
pool.getConnection()
    .then(connection => {
        console.log('✅ Connexion à MySQL établie');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erreur de connexion MySQL:', err.message);
    });

module.exports = pool;
