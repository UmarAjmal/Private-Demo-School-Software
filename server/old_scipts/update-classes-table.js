const pool = require('./db');

const updateClassesTable = async () => {
    try {
        console.log("Adding description column to classes table...");
        await pool.query(`
            ALTER TABLE classes 
            ADD COLUMN IF NOT EXISTS description TEXT;
        `);
        console.log("Successfully added 'description' column to classes table.");
    } catch (err) {
        console.error("Error updating classes table:", err.message);
    } finally {
        pool.end();
    }
};

updateClassesTable();
