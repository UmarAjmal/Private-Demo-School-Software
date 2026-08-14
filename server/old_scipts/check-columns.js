const pool = require('./db');

const checkColumns = async () => {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'students';
        `);
        console.log("Columns in students table:", res.rows.map(r => r.column_name));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
};

checkColumns();