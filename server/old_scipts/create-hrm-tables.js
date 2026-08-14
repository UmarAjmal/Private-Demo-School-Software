const pool = require('./db');

const createHRMTables = async () => {
    try {
        // Create Departments Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                department_id SERIAL PRIMARY KEY,
                department_name VARCHAR(100) UNIQUE NOT NULL,
                head_of_department VARCHAR(100),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Departments table checked/created.");

        // Create Employees Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS employees (
                employee_id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(150),
                phone VARCHAR(20),
                cnic VARCHAR(20) UNIQUE,
                designation VARCHAR(100),
                department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
                joining_date DATE,
                salary NUMERIC(15, 2),
                address TEXT,
                status VARCHAR(20) DEFAULT 'Active', -- Active, Resigned, Terminated
                app_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL, -- Link to system user
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Employees table checked/created.");

    } catch (err) {
        console.error("Error creating HRM tables:", err.message);
    } finally {
        pool.end();
    }
};

createHRMTables();
