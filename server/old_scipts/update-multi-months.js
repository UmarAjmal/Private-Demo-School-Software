const pool = require('./db');

async function run() {
    try {
        console.log('Adding multi-month columns to monthly_fee_slips...');
        await pool.query('ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS has_multi_months boolean DEFAULT false;');
        await pool.query('ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS months_list integer[];');
        console.log('Columns added successfully.');
    } catch(e) {
        console.error('Error adding columns:', e.message);
    } finally {
        process.exit();
    }
}

run();
