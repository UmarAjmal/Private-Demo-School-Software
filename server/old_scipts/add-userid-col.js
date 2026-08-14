const pool = require('./db');

async function migrate() {
    try {
        console.log("Adding user_id to students table...");
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS user_id INT REFERENCES app_users(id) ON DELETE SET NULL;
        `);
        console.log("Migration complete.");
    } catch (e) {
        console.error(e);
    }
}

migrate();