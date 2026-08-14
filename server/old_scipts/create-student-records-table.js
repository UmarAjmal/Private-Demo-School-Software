const pool = require('./db');

async function createStudentRecordsTable() {
    try {
        console.log("Creating student_academic_records table...");
        
        // Create table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_academic_records (
                id SERIAL PRIMARY KEY,
                
                -- Student reference
                student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                
                -- Academic year this record belongs to
                academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
                
                -- Class/Section placement for THIS year
                class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                roll_no VARCHAR(50),
                
                -- Performance snapshot (calculated from exam_marks)
                total_marks NUMERIC(10,2) DEFAULT 0,
                obtained_marks NUMERIC(10,2) DEFAULT 0,
                percentage NUMERIC(5,2) DEFAULT 0,
                grade VARCHAR(10),
                rank_in_class INTEGER,
                
                -- Status for this year
                status VARCHAR(20) DEFAULT 'active',
                -- Values: 'active', 'promoted', 'detained', 'left', 'transferred'
                
                -- Promotion details (filled when promoted)
                promoted_to_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                promoted_to_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                promoted_on DATE,
                promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                
                -- Additional metadata
                attendance_percentage NUMERIC(5,2),
                remarks TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Unique constraint: One record per student per year
                UNIQUE(student_id, academic_year_id)
            );
        `);
        
        console.log("✓ student_academic_records table created");
        
        // Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_sar_student 
            ON student_academic_records(student_id);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_sar_year_class 
            ON student_academic_records(academic_year_id, class_id, section_id);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_sar_status 
            ON student_academic_records(status);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_sar_promotion 
            ON student_academic_records(promoted_to_year_id, promoted_to_class_id) 
            WHERE promoted_to_year_id IS NOT NULL;
        `);
        
        console.log("✓ Indexes created successfully");
        
        // Create automatic updated_at trigger
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_sar_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        await pool.query(`
            DROP TRIGGER IF EXISTS sar_update_timestamp ON student_academic_records;
            CREATE TRIGGER sar_update_timestamp
            BEFORE UPDATE ON student_academic_records
            FOR EACH ROW
            EXECUTE FUNCTION update_sar_timestamp();
        `);
        
        console.log("✓ Automatic timestamp trigger created");
        console.log("\n✅ Student academic records table setup complete!");
        
        process.exit(0);
    } catch (err) {
        console.error("Error creating student records table:", err.message);
        process.exit(1);
    }
}

createStudentRecordsTable();
