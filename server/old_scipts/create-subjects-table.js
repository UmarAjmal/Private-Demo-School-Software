const pool = require('./db');

const createSubjectsTable = async () => {
    try {
        console.log("Creating/Checking Subjects Table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                subject_id SERIAL PRIMARY KEY,
                subject_name VARCHAR(100) NOT NULL,
                subject_code VARCHAR(50),
                section_id INTEGER REFERENCES sections(section_id) ON DELETE CASCADE,
                total_marks INTEGER DEFAULT 100,
                passing_marks INTEGER DEFAULT 33,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(section_id, subject_name) -- Prevent duplicate subject names in same section
            );
        `);
        console.log("Subjects table created successfully.");
    } catch (err) {
        console.error("Error creating subjects table:", err.message);
    } finally {
        pool.end();
    }
};

createSubjectsTable();
