const pool = require('./db');

const enhanceEmployeesForTeachers = async () => {
    const client = await pool.connect();
    try {
        console.log("🔧 Enhancing Employees table for Teacher management...");
        
        await client.query('BEGIN');

        // 1. Add teacher-specific columns to employees (if not exist)
        console.log("📝 Adding teacher-specific columns...");
        
        await client.query(`
            ALTER TABLE employees 
            ADD COLUMN IF NOT EXISTS subject_specialization TEXT,
            ADD COLUMN IF NOT EXISTS qualification TEXT,
            ADD COLUMN IF NOT EXISTS teaching_experience TEXT;
        `);

        // 2. Create teacher-subject assignment table
        console.log("📚 Creating teacher-subject assignment table...");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS teacher_subject_assignment (
                assignment_id SERIAL PRIMARY KEY,
                employee_id INTEGER REFERENCES employees(employee_id) ON DELETE CASCADE,
                subject_id INTEGER REFERENCES subjects(subject_id) ON DELETE CASCADE,
                academic_year VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, subject_id, academic_year)
            );
        `);

        // 3. Create teacher-class assignment table
        console.log("🏫 Creating teacher-class assignment table...");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS teacher_class_assignment (
                assignment_id SERIAL PRIMARY KEY,
                employee_id INTEGER REFERENCES employees(employee_id) ON DELETE CASCADE,
                class_id INTEGER REFERENCES classes(class_id) ON DELETE CASCADE,
                section_id INTEGER REFERENCES sections(section_id) ON DELETE SET NULL,
                is_class_teacher BOOLEAN DEFAULT FALSE,
                academic_year VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, class_id, section_id, academic_year)
            );
        `);

        // 4. Create Teaching Staff Department (if not exists)
        console.log("👥 Setting up Teaching Staff department...");
        
        const deptCheck = await client.query(
            "SELECT department_id FROM departments WHERE department_name = 'Teaching Staff'"
        );

        let teachingDeptId;
        if (deptCheck.rows.length === 0) {
            const newDept = await client.query(`
                INSERT INTO departments (department_name, description) 
                VALUES ('Teaching Staff', 'Faculty and Teaching Personnel') 
                RETURNING department_id
            `);
            teachingDeptId = newDept.rows[0].department_id;
            console.log(`✅ Created Teaching Staff department (ID: ${teachingDeptId})`);
        } else {
            teachingDeptId = deptCheck.rows[0].department_id;
            console.log(`✅ Teaching Staff department already exists (ID: ${teachingDeptId})`);
        }

        // 5. Create index for faster queries
        console.log("⚡ Creating performance indexes...");
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees(designation);
            CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
            CREATE INDEX IF NOT EXISTS idx_teacher_subject_employee ON teacher_subject_assignment(employee_id);
            CREATE INDEX IF NOT EXISTS idx_teacher_class_employee ON teacher_class_assignment(employee_id);
        `);

        await client.query('COMMIT');
        
        console.log("\n✅ SUCCESS! Teacher management schema is ready.");
        console.log("\n📋 Summary:");
        console.log("   - Added teacher-specific columns to employees");
        console.log("   - Created teacher-subject assignment table");
        console.log("   - Created teacher-class assignment table");
        console.log("   - Set up Teaching Staff department");
        console.log("   - Added performance indexes");
        console.log("\n💡 Next: Create teachers in HRM with designation containing 'Teacher'");
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error:", err.message);
    } finally {
        client.release();
        pool.end();
    }
};

enhanceEmployeesForTeachers();
