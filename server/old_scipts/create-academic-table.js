const pool = require('./db');

async function createAcademicTables() {
    try {
        console.log("Creating Academic Tables...");

        // 1. Create Academic Years Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id SERIAL PRIMARY KEY,
                year_name VARCHAR(20) NOT NULL UNIQUE,
                start_date DATE,
                end_date DATE,
                is_active BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'upcoming' -- upcoming, active, completed
            );
        `);

        // 2. Create Academic Terms Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS academic_terms (
                id SERIAL PRIMARY KEY,
                academic_year_id INT REFERENCES academic_years(id) ON DELETE CASCADE,
                term_name VARCHAR(100) NOT NULL,
                has_summer_work BOOLEAN DEFAULT FALSE,
                has_winter_work BOOLEAN DEFAULT FALSE,
                start_date DATE,
                end_date DATE
            );
        `);

        // 3. Pre-populate 50 Years (2025 - 2075)
        const check = await pool.query("SELECT COUNT(*) FROM academic_years");
        if (parseInt(check.rows[0].count) === 0) {
            console.log("Populating 50 years of academic cycles...");
            
            const startYear = 2025;
            const endYear = 2075;
            let values = [];
            
            for (let y = startYear; y <= endYear; y++) {
                // Assuming a typical cycle like "2025-2026"
                const yearName = `${y}-${y + 1}`;
                // We'll leave dates null for user to configure later, or set defaults
                // Let's just insert the names for now
                await pool.query(
                    "INSERT INTO academic_years (year_name, status) VALUES ($1, 'upcoming')", 
                    [yearName]
                );
            }
            console.log("Inserted years from 2025-2026 to 2075-2076.");
        } else {
            console.log("Academic years already exist. Skipping population.");
        }

        console.log("Academic Setup Tables created successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error creating academic tables:", err.message);
        process.exit(1);
    }
}

createAcademicTables();
