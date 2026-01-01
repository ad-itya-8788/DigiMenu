// ============================================
// 🗄️ DATABASE CONNECTION POOL - PostgreSQL
// ============================================
// Ye file database connection manage karti hai
// Connection pool use karta hai (multiple connections efficiently manage karta hai)

const { Pool } = require("pg");
require("dotenv").config();

// ⏰ Timezone set karo (IST - India Standard Time)
process.env.TZ = 'Asia/Kolkata';

// 🔒 Production Safety Check
// Production me database password zaroori hai
if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
    console.error("❌ FATAL: DB_PASSWORD must be set in production environment");
    process.exit(1); // Server band kar do agar password nahi hai
}

// 🏊 Connection Pool banao
// Pool = Multiple database connections ka group
// Isse performance improve hoti hai (har request ke liye naya connection nahi banana padta)
const pool = new Pool({
    user: process.env.DB_USER, // Database username
    host: process.env.DB_HOST, // Database server address
    database: process.env.DB_NAME || "DigiMenu", // Database name
    password: process.env.DB_PASSWORD || "1234", // Database password (development default)
    port: parseInt(process.env.DB_PORT) || 5432, // PostgreSQL default port
    max: 30, // Maximum 30 connections pool me
    min: 5, // Minimum 5 connections hamesha ready rahenge
    idleTimeoutMillis: 30000, // 30 seconds idle connection ko close kar do
    connectionTimeoutMillis: 5000, // 5 seconds me connection nahi mila to timeout
    options: '-c timezone=Asia/Kolkata' // Database timezone set karo
});

// ✅ Initial Connection Test
// Server start hote hi database se connect karo aur test karo
pool.connect((err, client, release) => {
    if (err) {
        console.error("❌ Database connection error:", err.message);
        // Production me database connection zaroori hai
        if (process.env.NODE_ENV === 'production') {
            console.error("❌ FATAL: Cannot connect to database in production");
            process.exit(1); // Server band kar do
        }
    } else {
        console.log("✅ Connected to PostgreSQL Database");
        release(); // Connection pool me wapas bhej do
    }
});

// 🚨 Unexpected Database Errors Handle karo
// Agar connection pool me koi error aaye to log karo
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// 🛑 Graceful Shutdown
// Server band hone se pehle database connections properly close karo
process.on('SIGTERM', () => {
    pool.end(() => {
        console.log('✅ Database pool closed gracefully');
    });
});

// Export karo taaki dusri files use kar sakein
module.exports = pool;
