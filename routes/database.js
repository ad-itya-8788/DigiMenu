// Database connection pool for PostgreSQL

const { Pool } = require("pg");
require("dotenv").config();

process.env.TZ = 'Asia/Kolkata';

if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
    console.error("DB_PASSWORD not set in production");
    process.exit(1);
}

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME || "DigiMenu",
    password: process.env.DB_PASSWORD || "1234",
    port: parseInt(process.env.DB_PORT) || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    options: '-c timezone=Asia/Kolkata'
});

pool.connect((err, client, release) => {
    if (err) {
        console.error("Error connecting to database:", err.message);
        if (process.env.NODE_ENV === 'production') {
            console.error("Cannot connect to database in production");
            process.exit(1);
        }
    } else {
        console.log("Connected to PostgreSQL Database");
        release();
    }
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

process.on('SIGTERM', () => {
    pool.end(() => {
        console.log('Database pool has ended');
    });
});

module.exports = pool;
