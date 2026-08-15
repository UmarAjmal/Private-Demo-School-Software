const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');
const { execSync } = require('child_process');

async function resetDb() {
    console.log("Starting Factory Reset of Database...");
    try {
        const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
        const tables = r.rows.map(x => '"' + x.table_name + '"').join(', ');
        
        if (tables.length > 0) {
            console.log("Truncating ALL tables...");
            await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
            console.log("All tables truncated successfully.");
        }

        const scripts = [
            'create-user-roles.js',
            'create-settings-table.js',
            'create-system-settings.js',
            'create-fee-tables.js',
            'create-academic-table.js',
            'enhance-employees-for-teachers.js',
            'add-opb-head.js',
            'seed-school-settings.js',
            'seed-backup-settings.js'
        ];

        console.log("Re-seeding database...");
        for (const script of scripts) {
            console.log(`Running ${script}...`);
            try {
                execSync(`node ${script}`, { cwd: __dirname, stdio: 'inherit' });
            } catch(err) {
                console.error(`Failed to run ${script}:`, err.message);
            }
        }
        
        console.log("Database Factory Reset Complete.");
        process.exit(0);
    } catch(e) {
        console.error("Factory reset failed:", e);
        process.exit(1);
    }
}

resetDb();
