const pool = require('./db');

async function createExamFeeCollectionTable() {
    try {
        console.log("Creating exam_fee_collections table...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exam_fee_collections (
                id SERIAL PRIMARY KEY,
                collection_name VARCHAR(100) NOT NULL,
                student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
                remarks TEXT,
                collected_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                collection_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(collection_name, student_id)
            );
        `);
        
        console.log("✅ exam_fee_collections table created successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error creating table:", err.message);
        process.exit(1);
    }
}

createExamFeeCollectionTable();
