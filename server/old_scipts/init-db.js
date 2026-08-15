const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');

async function initDb() {
    try {
        console.log(`Attempting to connect to database: ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT} as user ${process.env.DB_USER}`);
        const sqlPath = path.join(__dirname, 'database.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Running Database setup...');
        await pool.query(sql);
        console.log('Database tables created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error setting up database:', err.message);
        process.exit(1);
    }
}

initDb();
