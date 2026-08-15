require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixDB() {
    try {
        console.log("Adding missing columns to monthly_fee_slips...");
        await pool.query(`
            ALTER TABLE monthly_fee_slips 
            ADD COLUMN IF NOT EXISTS issue_date DATE,
            ADD COLUMN IF NOT EXISTS is_family_slip BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_multi_months BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS months_list INTEGER[],
            ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP;
        `);
        console.log("Columns added successfully!");
    } catch(err) {
        console.error("Error:", err.message);
    } finally {
        pool.end();
    }
}

fixDB();
