// Database Connection Pool - PostgreSQL
const { Pool } = require("pg");
require("dotenv").config();

// Set timezone to IST
process.env.TZ = 'Asia/Kolkata';

// Production safety check
if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
    console.error("❌ FATAL: DB_PASSWORD must be set in production environment");
    process.exit(1);
}

// Create connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME || "DigiMenu",
    password: process.env.DB_PASSWORD || "1234",
    port: parseInt(process.env.DB_PORT) || 5432,
    max: 30,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    options: '-c timezone=Asia/Kolkata'
});

// Test initial connection
pool.connect((err, client, release) => {
    if (err) {
        console.error("❌ Database connection error:", err.message);
        if (process.env.NODE_ENV === 'production') {
            console.error("❌ FATAL: Cannot connect to database in production");
            process.exit(1);
        }
    } else {
        console.log("✅ Connected to PostgreSQL Database");
        release();
    }
});

// Handle unexpected errors
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    pool.end(() => {
        console.log('✅ Database pool closed gracefully');
    });
});

module.exports = pool;
