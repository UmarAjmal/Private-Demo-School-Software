const pool = require('./db');

const updateEmployeeSchema = async () => {
    try {
        console.log("Updating Employees table schema...");
        
        const queries = [
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(50)",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS qualification VARCHAR(100)",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS experience VARCHAR(50)",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)"
        ];

        for (const query of queries) {
            await pool.query(query);
        }
        
        console.log("Employees table schema updated successfully.");

    } catch (err) {
        console.error("Error updating schema:", err.message);
    } finally {
        pool.end();
    }
};

updateEmployeeSchema();
