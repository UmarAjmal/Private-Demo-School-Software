const pool = require('./db');

const createClassesTables = async () => {
    try {
        // Classes Table (Already exists in some scripts, but ensuring structure)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS classes (
                class_id SERIAL PRIMARY KEY,
                class_name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Classes table checked/created.");

        // Sections Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sections (
                section_id SERIAL PRIMARY KEY,
                section_name VARCHAR(50) NOT NULL,
                class_id INTEGER REFERENCES classes(class_id) ON DELETE CASCADE,
                capacity INTEGER DEFAULT 30,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(class_id, section_name) -- Prevent duplicate sections per class
            );
        `);
        console.log("Sections table checked/created.");

    } catch (err) {
        console.error("Error creating Classes tables:", err.message);
    } finally {
        pool.end();
    }
};

createClassesTables();
