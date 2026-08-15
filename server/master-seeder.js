require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const bcrypt = require('bcryptjs');

console.log('======================================================');
console.log('   MASTER SEEDER & SCHEMA INITIALIZATION SCRIPT       ');
console.log('======================================================');

async function runMasterSeeder() {
    console.log('Starting full schema initialization & data seeding...\n');

    // =========================================================================
    // 1. AUTHENTICATION & USER MANAGEMENT TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("🔐 Setting up User & Role Management Tables...");

            // 1.1 app_roles Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS app_roles (
                    id SERIAL PRIMARY KEY,
                    role_name VARCHAR(50) NOT NULL UNIQUE,
                    description TEXT,
                    role_level INTEGER DEFAULT 50,
                    is_custom BOOLEAN DEFAULT FALSE,
                    is_system_default BOOLEAN DEFAULT FALSE,
                    dashboard_access VARCHAR(50) DEFAULT 'admin',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS role_level INTEGER DEFAULT 50;
                ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
                ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT FALSE;
                ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS dashboard_access VARCHAR(50) DEFAULT 'admin';
            `);

            // 1.2 role_permissions Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS role_permissions (
                    id SERIAL PRIMARY KEY,
                    role_id INT REFERENCES app_roles(id) ON DELETE CASCADE,
                    module_name VARCHAR(50) NOT NULL,
                    can_read BOOLEAN DEFAULT FALSE,
                    can_write BOOLEAN DEFAULT FALSE,
                    can_delete BOOLEAN DEFAULT FALSE,
                    UNIQUE(role_id, module_name)
                );
            `);

            // 1.3 app_users Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS app_users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    plain_password VARCHAR(255),
                    full_name VARCHAR(100),
                    email VARCHAR(100),
                    role_id INT REFERENCES app_roles(id) ON DELETE SET NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    failed_login_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE app_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
                ALTER TABLE app_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
            `);

            // 1.4 user_sessions Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                    session_token TEXT UNIQUE NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    remember_me BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_revoked BOOLEAN DEFAULT FALSE
                );
                CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
            `);

            // 1.5 user_direct_permissions Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS user_direct_permissions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                    module_name VARCHAR(50) NOT NULL,
                    can_read BOOLEAN DEFAULT FALSE,
                    can_write BOOLEAN DEFAULT FALSE,
                    can_delete BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, module_name)
                );
            `);

            // 1.5 role_audit_log Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS role_audit_log (
                    id SERIAL PRIMARY KEY,
                    performed_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    action VARCHAR(100) NOT NULL,
                    details TEXT,
                    ip_address VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Seed Role Levels
            const roleLevels = {
                'Administrator': 100,
                'Principal': 95,
                'Vice Principal': 90,
                'Coordinator': 75,
                'Primary Head': 65,
                'Middle Head': 65,
                'Matric Head': 65,
                'Teacher': 50,
                'Accountant': 30,
                'Assistant': 20,
                'Student': 10
            };

            for (const [rName, rLevel] of Object.entries(roleLevels)) {
                const isSystem = ['Administrator', 'Teacher', 'Accountant', 'Student'].includes(rName);
                await pool.query(
                    `INSERT INTO app_roles (role_name, description, role_level, is_system_default, is_custom)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (role_name) DO UPDATE SET role_level = $3, is_system_default = $4`,
                    [rName, `${rName} Role`, rLevel, isSystem, !isSystem]
                );
            }

            // Update dashboard_access for roles
            await pool.query(`
                UPDATE app_roles SET dashboard_access = 'teacher' 
                WHERE LOWER(role_name) LIKE '%teacher%' OR LOWER(role_name) LIKE '%assistant%';

                UPDATE app_roles SET dashboard_access = 'accountant' 
                WHERE LOWER(role_name) LIKE '%accountant%';

                UPDATE app_roles SET dashboard_access = 'student' 
                WHERE LOWER(role_name) LIKE '%student%';

                UPDATE app_roles SET dashboard_access = 'admin' 
                WHERE LOWER(role_name) LIKE '%admin%' OR LOWER(role_name) LIKE '%principal%' OR LOWER(role_name) LIKE '%coordinator%' OR role_level >= 90;
            `);

            // Seed Administrator User (admin)
            const roleCheck = await pool.query("SELECT id FROM app_roles WHERE role_name = 'Administrator'");
            const adminRoleId = roleCheck.rows[0].id;

            const adminCheck = await pool.query("SELECT id FROM app_users WHERE username = 'admin'");
            if (adminCheck.rows.length === 0) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);
                await pool.query(
                    "INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id) VALUES ($1, $2, $3, $4, $5, $6)",
                    ['admin', hashedPassword, 'admin123', 'System Administrator', 'admin@smartschool.com', adminRoleId]
                );
                console.log("   ✓ Default Admin user created (username: admin, password: admin123)");
            }

            // Seed Root User (root)
            const rootCheck = await pool.query("SELECT id FROM app_users WHERE username = 'root'");
            if (rootCheck.rows.length === 0) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('root123', salt);
                await pool.query(
                    "INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id) VALUES ($1, $2, $3, $4, $5, $6)",
                    ['root', hashedPassword, 'root123', 'Root Administrator', 'root@smartschool.com', adminRoleId]
                );
                console.log("   ✓ Default Root user created (username: root, password: root123)");
            }

            // Seed Core Role Permissions
            const ROLE_PERMS = {
                'Administrator': [
                    'dashboard', 'students', 'academic', 'hrm', '__exam__', 'expenses', 'fees', 'attendance', 'reports', 'settings',
                    'dash.admin_kpi', 'dash.admin_charts', 'dash.admin_recent',
                    'dash.teacher_kpi', 'dash.teacher_att', 'dash.teacher_classes',
                    'dash.acc_kpi', 'dash.acc_charts',
                    'dash.student_kpi', 'dash.student_att', 'dash.student_fees'
                ],
                'Teacher': [
                    'dashboard', 'dash.teacher_kpi', 'dash.teacher_att', 'dash.teacher_classes',
                    'attendance', '__exam__', 'academic', 'students'
                ],
                'Accountant': [
                    'dashboard', 'dash.acc_kpi', 'dash.acc_charts',
                    'fees', 'expenses', 'reports', 'students'
                ],
                'Student': [
                    'dashboard', 'dash.student_kpi', 'dash.student_att', 'dash.student_fees'
                ]
            };

            const rolesRes = await pool.query("SELECT id, role_name FROM app_roles");
            const roleMap = {};
            rolesRes.rows.forEach(r => roleMap[r.role_name] = r.id);

            for (const [roleName, modules] of Object.entries(ROLE_PERMS)) {
                const rId = roleMap[roleName];
                if (!rId) continue;

                if (roleName !== 'Administrator') {
                    await pool.query("DELETE FROM role_permissions WHERE role_id = $1", [rId]);
                }

                for (const mod of modules) {
                    await pool.query(`
                        INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete)
                        VALUES ($1, $2, true, true, true)
                        ON CONFLICT (role_id, module_name)
                        DO UPDATE SET can_read=true, can_write=true, can_delete=true;
                    `, [rId, mod]);
                }
            }

            console.log("   ✅ User & Role Management Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up auth tables:", err.message);
        }
    })();

    // =========================================================================
    // 2. SCHOOL & SYSTEM SETTINGS TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("⚙️ Setting up School & System Settings Tables...");

            // 2.1 school_settings Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS school_settings (
                    id SERIAL PRIMARY KEY,
                    school_name VARCHAR(255) DEFAULT 'Smart School',
                    address TEXT,
                    contact_number VARCHAR(50),
                    email VARCHAR(255),
                    tagline VARCHAR(255),
                    website VARCHAR(255),
                    logo_url TEXT,
                    facebook_link VARCHAR(255),
                    twitter_link VARCHAR(255),
                    instagram_link VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE school_settings ALTER COLUMN logo_url TYPE TEXT;
            `);

            const ssCheck = await pool.query("SELECT * FROM school_settings LIMIT 1");
            if (ssCheck.rows.length === 0) {
                await pool.query(`
                    INSERT INTO school_settings (school_name, tagline, address, contact_number) 
                    VALUES ('Falcon School System', 'Excellence in Education', '83/M Madina Colony Vehari', '0300-7730141')
                `);
            }

            // 2.2 system_settings Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    setting_key VARCHAR(100) PRIMARY KEY,
                    setting_value TEXT NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    description TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            const sysDefaults = [
                { key: 'school_name', value: 'Falcon School System', category: 'general', desc: 'Official name of the institution' },
                { key: 'school_address', value: '83/M Madina Colony Vehari', category: 'general', desc: 'School address' },
                { key: 'phone_number', value: '0300-7730141', category: 'general', desc: 'Primary school phone number' },
                { key: 'school_phone2', value: '0308-7696430', category: 'general', desc: 'Secondary phone number' },
                { key: 'school_phone3', value: '067-3366383', category: 'general', desc: 'Landline number' },
                { key: 'school_tagline', value: 'Excellence in Education', category: 'general', desc: 'School tagline' },
                { key: 'school_logo_url', value: '', category: 'general', desc: 'School logo URL' },
                { key: 'contact_email', value: 'admin@shaheenschool.edu', category: 'general', desc: 'Primary contact email' },
                { key: 'session_timeout_minutes', value: '1440', category: 'security', desc: 'User inactivity timeout in minutes' },
                { key: 'max_login_attempts', value: '5', category: 'security', desc: 'Lock account after X failed attempts' },
                { key: 'password_min_length', value: '6', category: 'security', desc: 'Minimum allowed password length' },
                { key: 'auto_backup_enabled', value: 'false', category: 'backup', desc: 'Enable automatic scheduled backups' },
                { key: 'backup_frequency', value: 'daily', category: 'backup', desc: 'Scheduled backup frequency' },
                { key: 'backup_time', value: '08:00', category: 'backup', desc: 'Primary shift 1 time to run backup' },
                { key: 'backup_time_1', value: '08:00', category: 'backup', desc: 'Shift 1 morning daily backup time' },
                { key: 'backup_time_2', value: '20:00', category: 'backup', desc: 'Shift 2 evening daily backup time' },
                { key: 'backup_path', value: '', category: 'backup', desc: 'Custom backup storage directory path' },
                { key: 'last_backup_info', value: '', category: 'backup', desc: 'Latest database backup metadata & notification' },
                { key: 'maintenance_mode', value: 'false', category: 'system', desc: 'Put system in read-only mode for maintenance' }
            ];

            for (const setting of sysDefaults) {
                await pool.query(`
                    INSERT INTO system_settings (setting_key, setting_value, category, description)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (setting_key) DO NOTHING
                `, [setting.key, setting.value, setting.category, setting.desc]);
            }

            console.log("   ✅ School & System Settings Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up settings tables:", err.message);
        }
    })();

    // =========================================================================
    // 3. ACADEMIC STRUCTURE & YEARS TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("🏫 Setting up Academic Structure Tables...");

            // 3.1 classes Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS classes (
                    class_id SERIAL PRIMARY KEY,
                    class_name VARCHAR(100) UNIQUE NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE classes ADD COLUMN IF NOT EXISTS description TEXT;
            `);

            // 3.2 sections Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sections (
                    section_id SERIAL PRIMARY KEY,
                    section_name VARCHAR(50) NOT NULL,
                    class_id INTEGER REFERENCES classes(class_id) ON DELETE CASCADE,
                    capacity INTEGER DEFAULT 30,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(class_id, section_name)
                );
            `);

            // 3.3 subjects Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS subjects (
                    subject_id SERIAL PRIMARY KEY,
                    subject_name VARCHAR(100) NOT NULL,
                    subject_code VARCHAR(50),
                    section_id INTEGER REFERENCES sections(section_id) ON DELETE CASCADE,
                    total_marks INTEGER DEFAULT 100,
                    passing_marks INTEGER DEFAULT 33,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(section_id, subject_name)
                );
            `);

            // 3.4 academic_years Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS academic_years (
                    id SERIAL PRIMARY KEY,
                    year_name VARCHAR(20) NOT NULL UNIQUE,
                    start_date DATE,
                    end_date DATE,
                    is_active BOOLEAN DEFAULT FALSE,
                    status VARCHAR(20) DEFAULT 'upcoming',
                    is_configured BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS is_configured BOOLEAN DEFAULT FALSE;
            `);

            // 3.5 academic_terms Table
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
                ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS has_summer_work BOOLEAN DEFAULT FALSE;
                ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS has_winter_work BOOLEAN DEFAULT FALSE;
            `);

            // Pre-populate 50 Academic Years (2025 - 2075)
            const yearCheck = await pool.query("SELECT COUNT(*) FROM academic_years");
            if (parseInt(yearCheck.rows[0].count) === 0) {
                console.log("   → Populating 50 years of academic cycles (2025-2075)...");
                for (let y = 2025; y <= 2075; y++) {
                    await pool.query(
                        "INSERT INTO academic_years (year_name, status) VALUES ($1, 'upcoming') ON CONFLICT DO NOTHING",
                        [`${y}-${y + 1}`]
                    );
                }
            }

            console.log("   ✅ Academic Structure Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up academic tables:", err.message);
        }
    })();

    // =========================================================================
    // 4. STUDENTS, FAMILIES & ACADEMIC RECORDS TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("👨‍🎓 Setting up Students, Families & Academic Records Tables...");

            // 4.1 students Table
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
                    student_mobile VARCHAR(20),
                    email VARCHAR(100),
                    admission_date DATE DEFAULT CURRENT_DATE,
                    image_url TEXT,
                    father_name VARCHAR(100),
                    father_phone VARCHAR(20),
                    father_cnic VARCHAR(50),
                    father_occupation VARCHAR(100),
                    mother_name VARCHAR(100),
                    mother_phone VARCHAR(20),
                    mother_cnic VARCHAR(50),
                    mother_occupation VARCHAR(100),
                    current_address TEXT,
                    permanent_address TEXT,
                    city VARCHAR(100),
                    cnic_bform VARCHAR(50),
                    has_disability BOOLEAN DEFAULT FALSE,
                    disability_details TEXT,
                    is_orphan BOOLEAN DEFAULT FALSE,
                    guardian_name VARCHAR(100),
                    guardian_relation VARCHAR(50),
                    guardian_phone VARCHAR(20),
                    guardian_cnic VARCHAR(50),
                    guardian_address TEXT,
                    monthly_fee NUMERIC(10, 2) DEFAULT 0.00,
                    admission_fee NUMERIC(10, 2) DEFAULT 0.00,
                    other_charges NUMERIC(10, 2) DEFAULT 0.00,
                    documents TEXT,
                    status VARCHAR(20) DEFAULT 'Active',
                    family_id VARCHAR(50),
                    sibling_relation VARCHAR(20) DEFAULT 'blood',
                    user_id INT REFERENCES app_users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Apply all student column alterations safely
            const studentAlters = [
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active'",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Normal'",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date DATE DEFAULT CURRENT_DATE",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS cnic_bform VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS religion VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS dob DATE",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS has_disability BOOLEAN DEFAULT FALSE",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS disability_details TEXT",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS student_mobile VARCHAR(20)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS current_address TEXT",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS permanent_address TEXT",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_phone VARCHAR(20)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_cnic VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS father_occupation VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_phone VARCHAR(20)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_cnic VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_occupation VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS is_orphan BOOLEAN DEFAULT FALSE",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(100)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(20)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_cnic VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_address TEXT",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10, 2) DEFAULT 0.00",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10, 2) DEFAULT 0.00",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS other_charges NUMERIC(10, 2) DEFAULT 0.00",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS image_url TEXT",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS documents TEXT",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS family_id VARCHAR(50)",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS sibling_relation VARCHAR(20) DEFAULT 'blood'",
                "ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id INT REFERENCES app_users(id) ON DELETE SET NULL"
            ];
            for (const q of studentAlters) {
                await pool.query(q);
            }

            // 4.2 families Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS families (
                    family_id VARCHAR(50) PRIMARY KEY,
                    family_name VARCHAR(200),
                    primary_contact_name VARCHAR(100),
                    primary_contact_phone VARCHAR(20),
                    family_fee NUMERIC(10,2) DEFAULT 0,
                    opening_balance NUMERIC(10,2) DEFAULT 0,
                    opening_balance_paid NUMERIC(10,2) DEFAULT 0,
                    opb_notes TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE families ADD COLUMN IF NOT EXISTS family_fee NUMERIC(10,2) DEFAULT 0;
                ALTER TABLE families ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(10,2) DEFAULT 0;
                ALTER TABLE families ADD COLUMN IF NOT EXISTS opening_balance_paid NUMERIC(10,2) DEFAULT 0;
                ALTER TABLE families ADD COLUMN IF NOT EXISTS opb_notes TEXT;
            `);

            // 4.3 student_siblings Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS student_siblings (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
                    sibling_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
                    relation_type VARCHAR(20) CHECK (relation_type IN ('blood', 'cousin')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, sibling_id)
                );
            `);

            // 4.4 student_academic_records Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS student_academic_records (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    roll_no VARCHAR(50),
                    total_marks NUMERIC(10,2) DEFAULT 0,
                    obtained_marks NUMERIC(10,2) DEFAULT 0,
                    percentage NUMERIC(5,2) DEFAULT 0,
                    grade VARCHAR(10),
                    rank_in_class INTEGER,
                    status VARCHAR(20) DEFAULT 'active',
                    promotion_target_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                    promotion_target_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                    promoted_to_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                    promoted_to_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                    promoted_on DATE,
                    promoted_at TIMESTAMP,
                    promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    attendance_percentage NUMERIC(5,2),
                    remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, academic_year_id)
                );
                ALTER TABLE student_academic_records ADD COLUMN IF NOT EXISTS promotion_target_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL;
                ALTER TABLE student_academic_records ADD COLUMN IF NOT EXISTS promotion_target_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL;
                ALTER TABLE student_academic_records ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;
                ALTER TABLE student_academic_records ADD COLUMN IF NOT EXISTS promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
            `);

            // Create Performance Indexes
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_students_family_id ON students(family_id);
                CREATE INDEX IF NOT EXISTS idx_sar_student ON student_academic_records(student_id);
                CREATE INDEX IF NOT EXISTS idx_sar_year_class ON student_academic_records(academic_year_id, class_id, section_id);
                CREATE INDEX IF NOT EXISTS idx_sar_status ON student_academic_records(status);
            `);

            // Automatic updated_at trigger for student_academic_records
            await pool.query(`
                CREATE OR REPLACE FUNCTION update_sar_timestamp()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS sar_update_timestamp ON student_academic_records;
                CREATE TRIGGER sar_update_timestamp
                BEFORE UPDATE ON student_academic_records
                FOR EACH ROW
                EXECUTE FUNCTION update_sar_timestamp();
            `);

            console.log("   ✅ Students, Families & Academic Records Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up student tables:", err.message);
        }
    })();

    // =========================================================================
    // 5. HRM & EMPLOYEE MANAGEMENT TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("👔 Setting up HRM & Employee Management Tables...");

            // 5.1 departments Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS departments (
                    department_id SERIAL PRIMARY KEY,
                    department_name VARCHAR(100) UNIQUE NOT NULL,
                    head_of_department VARCHAR(100),
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Seed Teaching Staff Department
            await pool.query(`
                INSERT INTO departments (department_name, description) 
                VALUES ('Teaching Staff', 'Faculty and Teaching Personnel')
                ON CONFLICT (department_name) DO NOTHING;
            `);

            // 5.2 employees Table
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
                    gender VARCHAR(20),
                    dob DATE,
                    marital_status VARCHAR(20),
                    emergency_contact VARCHAR(50),
                    qualification VARCHAR(100),
                    experience VARCHAR(50),
                    father_name VARCHAR(100),
                    blood_group VARCHAR(10),
                    subject_specialization TEXT,
                    teaching_experience TEXT,
                    status VARCHAR(20) DEFAULT 'Active',
                    app_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            const empAlters = [
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(50)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS qualification VARCHAR(100)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS experience VARCHAR(50)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS subject_specialization TEXT",
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS teaching_experience TEXT"
            ];
            for (const q of empAlters) {
                await pool.query(q);
            }

            // 5.3 teacher_subject_assignment Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS teacher_subject_assignment (
                    assignment_id SERIAL PRIMARY KEY,
                    employee_id INTEGER REFERENCES employees(employee_id) ON DELETE CASCADE,
                    subject_id INTEGER REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    academic_year VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(employee_id, subject_id, academic_year)
                );
            `);

            // 5.4 teacher_class_assignment Table
            await pool.query(`
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

            // Indexes
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees(designation);
                CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
                CREATE INDEX IF NOT EXISTS idx_teacher_subject_employee ON teacher_subject_assignment(employee_id);
                CREATE INDEX IF NOT EXISTS idx_teacher_class_employee ON teacher_class_assignment(employee_id);
            `);

            console.log("   ✅ HRM & Employee Management Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up HRM tables:", err.message);
        }
    })();

    // =========================================================================
    // 6. ATTENDANCE MODULE TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("📅 Setting up Attendance Module Tables...");

            // 6.1 student_attendance Table
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
                );
            `);

            // 6.2 staff_attendance Table
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
                );
            `);

            console.log("   ✅ Attendance Module Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up attendance tables:", err.message);
        }
    })();

    // =========================================================================
    // 7. EXPENSES MODULE TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("💸 Setting up Expenses Module Tables...");

            // 7.1 expense_categories Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS expense_categories (
                    category_id SERIAL PRIMARY KEY,
                    category_name VARCHAR(100) UNIQUE NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            `);

            // Seed default expense categories
            const defaultExpenseCategories = [
                ['Utilities', 'Electricity, Water, Gas, Internet bills'],
                ['Salaries & Wages', 'Staff salaries and daily wages'],
                ['Office Supplies', 'Paper, pens, printing material, stationery'],
                ['Maintenance & Repair', 'Building maintenance, plumbing, electrical repairs'],
                ['Events & Functions', 'School functions, sports day, annual day'],
                ['Transport', 'Fuel, vehicle maintenance, bus repairs'],
                ['Miscellaneous', 'Other unexpected small expenses']
            ];

            for (const [catName, catDesc] of defaultExpenseCategories) {
                await pool.query(
                    `INSERT INTO expense_categories (category_name, description) VALUES ($1, $2) ON CONFLICT (category_name) DO NOTHING`,
                    [catName, catDesc]
                );
            }

            // 7.2 expenses Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS expenses (
                    expense_id SERIAL PRIMARY KEY,
                    category_id INTEGER REFERENCES expense_categories(category_id) ON DELETE SET NULL,
                    expense_title VARCHAR(200) NOT NULL,
                    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
                    expense_date DATE DEFAULT CURRENT_DATE,
                    payment_method VARCHAR(50) DEFAULT 'Cash',
                    reference_no VARCHAR(100),
                    paid_to VARCHAR(150),
                    status VARCHAR(20) DEFAULT 'Approved',
                    description TEXT,
                    attachment VARCHAR(255),
                    receipt_url TEXT,
                    created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    approved_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE expenses 
                    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS attachment VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    ADD COLUMN IF NOT EXISTS receipt_url TEXT;

                CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
            `);

            console.log("   ✅ Expenses Module Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up expense tables:", err.message);
        }
    })();

    // =========================================================================
    // 8. FEE MANAGEMENT MODULE TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("💰 Setting up Fee Management Module Tables...");

            // 8.1 fee_heads Table (Create Table FIRST before any queries)
            await pool.query(`
                CREATE TABLE IF NOT EXISTS fee_heads (
                    head_id SERIAL PRIMARY KEY,
                    head_name VARCHAR(100) UNIQUE NOT NULL,
                    head_type VARCHAR(30) NOT NULL DEFAULT 'regular',
                    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // Cleanup duplicate fee_heads if table existed with duplicates
            await pool.query(`
                DELETE FROM fee_heads a USING fee_heads b
                WHERE a.head_id > b.head_id AND a.head_name = b.head_name;
            `).catch(() => { });

            // Enforce unique constraint
            await pool.query(`
                ALTER TABLE fee_heads ADD CONSTRAINT fee_heads_head_name_key UNIQUE (head_name);
            `).catch(() => { /* Ignore constraint already exists error */ });

            // Seed default fee heads idempotently
            const defaultFeeHeads = [
                ['Tuition Fee', 'regular', 'monthly', 'Monthly tuition charges'],
                ['Transport Fee', 'regular', 'monthly', 'School bus / transport service'],
                ['Exam Fee', 'extra', 'once', 'Examination charges per term'],
                ['Annual Fund', 'extra', 'yearly', 'Annual school development fund'],
                ['Sports Fee', 'regular', 'monthly', 'Sports activities & PE charges'],
                ['Lab Charges', 'regular', 'monthly', 'Science/Computer lab usage'],
                ['Library Fee', 'regular', 'monthly', 'Library access & maintenance'],
                ['Late Fine', 'extra', 'once', 'Fine for late fee payment'],
                ['Previous Balance', 'prev_balance', 'monthly', 'Previous dues carried forward']
            ];

            for (const [hName, hType, hFreq, hDesc] of defaultFeeHeads) {
                await pool.query(`
                    INSERT INTO fee_heads (head_name, head_type, frequency, description)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (head_name) DO UPDATE SET head_type = $2, frequency = $3, description = $4
                `, [hName, hType, hFreq, hDesc]);
            }

            // 8.2 fee_plans Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS fee_plans (
                    plan_id SERIAL PRIMARY KEY,
                    plan_name VARCHAR(150) NOT NULL,
                    class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                    applies_to_all BOOLEAN DEFAULT FALSE,
                    academic_year VARCHAR(20) NOT NULL DEFAULT '2026',
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN DEFAULT FALSE;
            `);

            // 8.3 fee_plan_classes Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS fee_plan_classes (
                    id SERIAL PRIMARY KEY,
                    plan_id INTEGER NOT NULL REFERENCES fee_plans(plan_id) ON DELETE CASCADE,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    UNIQUE(plan_id, class_id)
                );
            `);

            // 8.4 fee_plan_heads Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS fee_plan_heads (
                    id SERIAL PRIMARY KEY,
                    plan_id INTEGER NOT NULL REFERENCES fee_plans(plan_id) ON DELETE CASCADE,
                    head_id INTEGER NOT NULL REFERENCES fee_heads(head_id) ON DELETE CASCADE,
                    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    UNIQUE(plan_id, head_id)
                );
            `);

            // 8.5 monthly_fee_slips Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS monthly_fee_slips (
                    slip_id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    family_id VARCHAR(50),
                    class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
                    year INTEGER NOT NULL,
                    due_date DATE,
                    issue_date DATE,
                    has_multi_months BOOLEAN DEFAULT FALSE,
                    months_list INTEGER[],
                    is_family_slip BOOLEAN DEFAULT FALSE,
                    is_printed BOOLEAN DEFAULT FALSE,
                    printed_at TIMESTAMP,
                    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
                    generated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(student_id, month, year)
                );
            `);

            const slipAlters = [
                "ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS issue_date DATE",
                "ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS is_family_slip BOOLEAN DEFAULT FALSE",
                "ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS has_multi_months BOOLEAN DEFAULT FALSE",
                "ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS months_list INTEGER[]",
                "ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE",
                "ALTER TABLE monthly_fee_slips ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP"
            ];
            for (const q of slipAlters) {
                await pool.query(q);
            }

            // Indexes for Fee Slips & Reports Query Optimization
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_mfs_year_month ON monthly_fee_slips(year, month);
                CREATE INDEX IF NOT EXISTS idx_mfs_months_list ON monthly_fee_slips USING GIN (months_list);
                CREATE INDEX IF NOT EXISTS idx_mfs_family ON monthly_fee_slips(family_id);
                CREATE INDEX IF NOT EXISTS idx_mfs_student_month_year ON monthly_fee_slips(student_id, year, month);
            `);

            // 8.6 slip_line_items Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS slip_line_items (
                    item_id SERIAL PRIMARY KEY,
                    slip_id INTEGER NOT NULL REFERENCES monthly_fee_slips(slip_id) ON DELETE CASCADE,
                    head_id INTEGER REFERENCES fee_heads(head_id) ON DELETE SET NULL,
                    head_name VARCHAR(100) NOT NULL,
                    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    note TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_sli_slip_id ON slip_line_items(slip_id);
                CREATE INDEX IF NOT EXISTS idx_sli_head_id ON slip_line_items(head_id);
            `);

            // 8.7 fee_payments Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS fee_payments (
                    payment_id SERIAL PRIMARY KEY,
                    slip_id INTEGER NOT NULL REFERENCES monthly_fee_slips(slip_id) ON DELETE CASCADE,
                    amount_paid NUMERIC(10,2) NOT NULL,
                    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    payment_method VARCHAR(30) DEFAULT 'cash',
                    received_by VARCHAR(100),
                    reference_no VARCHAR(100),
                    notes TEXT,
                    is_printed BOOLEAN DEFAULT FALSE,
                    printed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE;
                ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP;
            `);

            // 8.8 family_opb_payments Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS family_opb_payments (
                    payment_id SERIAL PRIMARY KEY,
                    family_id VARCHAR(50) NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
                    amount NUMERIC(10,2) NOT NULL CHECK(amount > 0),
                    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    payment_method VARCHAR(30) DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','cheque','online','other')),
                    received_by VARCHAR(100),
                    reference_no VARCHAR(100),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_opb_payments_family ON family_opb_payments(family_id);
            `);

            // 8.9 admission_fee_ledger Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS admission_fee_ledger (
                    ledger_id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    discount NUMERIC(10,2) DEFAULT 0,
                    discount_amount NUMERIC(10,2) DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
                    admission_date DATE,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(student_id)
                );
                ALTER TABLE admission_fee_ledger ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;
                ALTER TABLE admission_fee_ledger ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
            `);

            // 8.10 admission_fee_payments Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS admission_fee_payments (
                    payment_id SERIAL PRIMARY KEY,
                    ledger_id INTEGER NOT NULL REFERENCES admission_fee_ledger(ledger_id) ON DELETE CASCADE,
                    amount_paid NUMERIC(10,2) NOT NULL,
                    discount_amount NUMERIC(10,2) DEFAULT 0,
                    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    payment_method VARCHAR(30) DEFAULT 'cash',
                    received_by VARCHAR(100),
                    reference_no VARCHAR(100),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // 8.11 exam_fee_collections Table
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

            console.log("   ✅ Fee Management Module Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up fee tables:", err.message);
        }
    })();

    // =========================================================================
    // 9. EXAMINATIONS & CLASS TESTS MODULE TABLES
    // =========================================================================
    await (async () => {
        try {
            console.log("📝 Setting up Examinations & Class Tests Module Tables...");

            // 9.1 exam_marks Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS exam_marks (
                    mark_id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
                    academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    total_marks NUMERIC(10,2) NOT NULL CHECK (total_marks > 0),
                    obtained_marks NUMERIC(10,2) NOT NULL CHECK (obtained_marks >= 0),
                    entered_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    entered_by_employee_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, subject_id, term_id),
                    CHECK (obtained_marks <= total_marks)
                );
                ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
            `);

            // 9.2 exam_mark_locks Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS exam_mark_locks (
                    lock_id SERIAL PRIMARY KEY,
                    term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    locked_by_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(term_id, class_id, section_id, subject_id, locked_by_user_id)
                );
            `);

            // 9.3 test_papers Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS test_papers (
                    test_id SERIAL PRIMARY KEY,
                    test_name VARCHAR(200) NOT NULL,
                    description TEXT,
                    total_marks NUMERIC(10,2) NOT NULL CHECK (total_marks > 0),
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    created_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    created_by_employee_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    approved_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    published_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE test_papers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
                ALTER TABLE test_papers ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
                ALTER TABLE test_papers ADD COLUMN IF NOT EXISTS published_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
            `);

            // 9.4 test_marks Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS test_marks (
                    test_mark_id SERIAL PRIMARY KEY,
                    test_id INTEGER NOT NULL REFERENCES test_papers(test_id) ON DELETE CASCADE,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    obtained_marks NUMERIC(10,2) CHECK (obtained_marks >= 0),
                    is_absent BOOLEAN DEFAULT FALSE,
                    remarks VARCHAR(300),
                    UNIQUE(test_id, student_id)
                );
                ALTER TABLE test_marks ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT FALSE;
            `);

            // 9.5 test_paper_locks Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS test_paper_locks (
                    lock_id SERIAL PRIMARY KEY,
                    test_id INTEGER NOT NULL REFERENCES test_papers(test_id) ON DELETE CASCADE,
                    locked_by_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(test_id, locked_by_user_id)
                );
            `);

            // 9.6 exam_sheet_approvals Table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS exam_sheet_approvals (
                    id SERIAL PRIMARY KEY,
                    sheet_type VARCHAR(20) NOT NULL CHECK (sheet_type IN ('term_exam', 'class_test')),
                    term_id INTEGER REFERENCES academic_terms(id) ON DELETE CASCADE,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    subject_id INTEGER REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    test_id INTEGER REFERENCES test_papers(test_id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'published')),
                    submitted_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    approved_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    approved_at TIMESTAMP,
                    published_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    published_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_sheet_term_exam ON exam_sheet_approvals (sheet_type, term_id, class_id, section_id, subject_id) WHERE sheet_type = 'term_exam';
                CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_sheet_class_test ON exam_sheet_approvals (test_id) WHERE sheet_type = 'class_test';
            `);

            // Indexes for Exam & Test Query Optimization
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_exam_marks_term_subject ON exam_marks(term_id, subject_id);
                CREATE INDEX IF NOT EXISTS idx_exam_marks_class_section ON exam_marks(class_id, section_id);
                CREATE INDEX IF NOT EXISTS idx_test_papers_class_sec_sub ON test_papers(class_id, section_id, subject_id);
                CREATE INDEX IF NOT EXISTS idx_test_marks_test_student ON test_marks(test_id, student_id);
            `);

            console.log("   ✅ Examinations & Class Tests Module Tables set up successfully.");
        } catch (err) {
            console.error("   ❌ Error setting up exam tables:", err.message);
        }
    })();

    // =========================================================================
    // 10. DATA INTEGRITY & REPAIR AUDITS
    // =========================================================================
    await (async () => {
        try {
            console.log("🛠️ Running Data Integrity Repairs...");

            // Repair blood siblings where father names differ
            const repairResult = await pool.query(`
                UPDATE student_siblings ss
                SET relation_type = 'cousin'
                FROM students a, students b
                WHERE ss.student_id = a.student_id
                  AND ss.sibling_id = b.student_id
                  AND ss.relation_type = 'blood'
                  AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') != ''
                  AND COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '') != ''
                  AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') 
                      != COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '')
            `);
            if (repairResult.rowCount > 0) {
                console.log(`   ✓ Repaired ${repairResult.rowCount} incorrectly marked blood sibling rows.`);
            }

            console.log("   ✅ Data Integrity Repairs completed.");
        } catch (err) {
            console.error("   ❌ Data repair error:", err.message);
        }
    })();

    // =========================================================================
    // 11. NOTIFICATIONS MODULE TABLE & SEQUENCE SYNC
    // =========================================================================
    await (async () => {
        try {
            console.log("🔔 Setting up Notifications Table & Indexes...");

            await pool.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES app_users(id) ON DELETE CASCADE,
                    family_id VARCHAR(50),
                    student_id INT REFERENCES students(student_id) ON DELETE CASCADE,
                    role VARCHAR(50),
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    link VARCHAR(255),
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_notif_family ON notifications(family_id);
                CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
                CREATE INDEX IF NOT EXISTS idx_notif_role ON notifications(role);
                CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
            `);

            console.log("   ✅ Notifications Table & Indexes created successfully.");

            // Synchronize all primary key sequences
            const { syncAllSequences } = require('./utils/sequenceSync');
            await syncAllSequences(pool);

        } catch (err) {
            console.error("   ❌ Notifications table setup error:", err.message);
        }
    })();

    console.log('\n======================================================');
    console.log('   MASTER SEEDER COMPLETED SUCCESSFULLY               ');
    console.log('======================================================\n');
}

if (require.main === module) {
    runMasterSeeder()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Fatal Master Seeder Error:", err);
            process.exit(1);
        });
}

module.exports = { runMasterSeeder };