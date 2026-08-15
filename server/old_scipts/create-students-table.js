const pool = require('./db');

const createStudentsTable = async () => {
    try {
        console.log("Creating Students Table (safe - no DROP)...");

        // SAFE: Use IF NOT EXISTS never drops existing data
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                student_id SERIAL PRIMARY KEY,
                admission_no VARCHAR(50) UNIQUE NOT NULL,
                roll_no VARCHAR(50),
                
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100),
                gender VARCHAR(20),
                dob DATE,
                
                class_id INTEGER REFERENCES classes(class_id),
                section_id INTEGER REFERENCES sections(section_id),
                
                category VARCHAR(50) DEFAULT 'Normal',
                religion VARCHAR(50),
                blood_group VARCHAR(10),
                
                mobile_no VARCHAR(20),
                email VARCHAR(100),
                
                admission_date DATE DEFAULT CURRENT_DATE,
                image_url TEXT,
                
                father_name VARCHAR(100),
                father_phone VARCHAR(20),
                mother_name VARCHAR(100),
                
                current_address TEXT,
                permanent_address TEXT,
                
                status VARCHAR(20) DEFAULT 'Active',
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Students table created/checked successfully.");
    } catch (err) {
        console.error("Error creating students table:", err.message);
    } finally {
        /* pool.end() removed for master seeder; */
    }
};

createStudentsTable();
