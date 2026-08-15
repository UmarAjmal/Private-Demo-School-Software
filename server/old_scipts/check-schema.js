const pool = require('./db');

async function checkConfig() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'students';");
        console.log("Columns in students table:", res.rows.map(r => r.column_name));
        
        const resUsers = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'app_users';");
        console.log("Columns in app_users table:", resUsers.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    }
}

checkConfig();