const pool = require('./db');

async function addYearConfiguration() {
    try {
        console.log("Adding is_configured column to academic_years...");
        
        // Add is_configured column
        await pool.query(`
            ALTER TABLE academic_years 
            ADD COLUMN IF NOT EXISTS is_configured BOOLEAN DEFAULT false;
        `);
        
        // Update existing years with dates as configured
        await pool.query(`
            UPDATE academic_years 
            SET is_configured = true 
            WHERE start_date IS NOT NULL;
        `);
        
        console.log("✓ is_configured column added successfully");
        console.log("✓ Existing configured years updated");
        
        process.exit(0);
    } catch (err) {
        console.error("Error adding configuration column:", err.message);
        process.exit(1);
    }
}

addYearConfiguration();
