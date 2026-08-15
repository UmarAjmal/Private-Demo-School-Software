const pool = require('./db');

async function check() {
    try {
        const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%teacher%'");
        console.log('Tables:', rows.map(r => r.table_name));

        for (const row of rows) {
            const table = row.table_name;
            const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
            console.log(`\nColumns for ${table}:`, res.rows.map(r => r.column_name));
        }

    } catch(err) {
        console.error(err);
    }
    process.exit();
}
check();