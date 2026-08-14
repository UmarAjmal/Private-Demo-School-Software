const pool = require('./db');

const updateStudentsTableComprehensive = async () => {
    try {
        console.log("Upgrading Students Table schema (safe ALTER - no DROP)...");

        // SAFE: Only ADD columns if they don't already exist. Never drops data.
        const alterQueries = [
            // System Identifiers
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active'",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Normal'",

            // Academic Info
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date DATE DEFAULT CURRENT_DATE",

            // Student Personal Info
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS cnic_bform VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS religion VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS dob DATE",

            // Disability Info
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS has_disability BOOLEAN DEFAULT FALSE",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS disability_details TEXT",

            // Contact Info
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS student_mobile VARCHAR(20)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS current_address TEXT",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS permanent_address TEXT",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS city VARCHAR(100)",

            // Parents Info
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_phone VARCHAR(20)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_cnic VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_occupation VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_phone VARCHAR(20)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_cnic VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_occupation VARCHAR(100)",

            // Guardian Info
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS is_orphan BOOLEAN DEFAULT FALSE",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(20)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_cnic VARCHAR(50)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_address TEXT",

            // Fee Structure
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10, 2) DEFAULT 0.00",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10, 2) DEFAULT 0.00",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS other_charges NUMERIC(10, 2) DEFAULT 0.00",

            // Misc
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS image_url TEXT",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS documents TEXT"
        ];

        for (const q of alterQueries) {
            await pool.query(q);
        }

        console.log("Students Table updated successfully with comprehensive schema (data preserved).");
    } catch (err) {
        console.error("Error updating students table:", err.message);
    }
};

updateStudentsTableComprehensive();