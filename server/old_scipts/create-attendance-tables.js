const pool = require('./db');

async function run() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS student_attendance (
            attendance_id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
            attendance_date DATE NOT NULL,
            status VARCHAR(20) NOT NULL CHECK (status IN ('Present','Absent','Late','Leave')),
            remarks VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(student_id, attendance_date)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_attendance (
            attendance_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            attendance_date DATE NOT NULL,
            status VARCHAR(20) NOT NULL CHECK (status IN ('Present','Absent','Late','Leave')),
            check_in_time TIME,
            check_out_time TIME,
            remarks VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(employee_id, attendance_date)
        )
    `);
    console.log('Attendance tables created successfully');
    pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
