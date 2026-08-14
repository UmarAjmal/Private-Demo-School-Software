const pool = require('./db');
const bcrypt = require('bcryptjs');

async function createAuthTables() {
    try {
        console.log("Setting up User & Role Management Tables...");

        // 1. Create Roles Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_roles (
                id SERIAL PRIMARY KEY,
                role_name VARCHAR(50) NOT NULL UNIQUE,
                description TEXT,
                is_system_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Create Permissions Table
        // We will store permissions as a JSONB object or separate table.
        // Let's use a separate table for cleaner relational queries
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

        // 3. Create Users Table
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Seed Administrator Role
        const roleCheck = await pool.query("SELECT * FROM app_roles WHERE role_name = 'Administrator'");
        let adminRoleId;

        if (roleCheck.rows.length === 0) {
            console.log("Creating default Administrator role...");
            const newRole = await pool.query(
                "INSERT INTO app_roles (role_name, description, is_system_default) VALUES ($1, $2, $3) RETURNING id",
                ['Administrator', 'Full System Access', true]
            );
            adminRoleId = newRole.rows[0].id;

            // Assign All Permissions
            const modules = ['dashboard', 'students', 'teachers', 'academic', 'settings', 'users_roles', 'fees'];
            
            for (const mod of modules) {
                await pool.query(
                    "INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete) VALUES ($1, $2, $3, $4, $5)",
                    [adminRoleId, mod, true, true, true]
                );
            }

            // Create Default Admin User
            // Password: 'admin123'
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            await pool.query(
                "INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id) VALUES ($1, $2, $3, $4, $5, $6)",
                ['admin', hashedPassword, 'admin123', 'System Administrator', 'admin@smartschool.com', adminRoleId]
            );
            console.log("Default Admin user created (user: admin, pass: admin123)");

        } else {
            console.log("Administrator role already exists.");
            adminRoleId = roleCheck.rows[0].id;
        }

        // 5. Seed Core Roles (Teacher, Accountant, Student)
        const coreRoles = [
            { name: 'Teacher', desc: 'Faculty & teaching staff' },
            { name: 'Accountant', desc: 'Finance & fee management' },
            { name: 'Student', desc: 'Student portal access' }
        ];

        for (const r of coreRoles) {
            await pool.query(
                "INSERT INTO app_roles (role_name, description, is_system_default) VALUES ($1, $2, $3) ON CONFLICT (role_name) DO UPDATE SET is_system_default = true",
                [r.name, r.desc, true]
            );
        }
        
        console.log("Core roles secured.");

        // 6. Seed Specific Core Role Permissions explicitly mapping UI toggles
        console.log("Seeding core role permissions...");
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
            const roleId = roleMap[roleName];
            if (!roleId) continue;

            // In case we are updating an existing layout, wipe old non-admin permissions to prevent feature bleed.
            if (roleName !== 'Administrator') {
                await pool.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);
            }

            for (const mod of modules) {
                await pool.query(`
                    INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete)
                    VALUES ($1, $2, true, true, true)
                    ON CONFLICT (role_id, module_name)
                    DO UPDATE SET can_read=true, can_write=true, can_delete=true;
                `, [roleId, mod]);
            }
        }
        console.log("Core role permissions mapped & stored.");

        console.log("Auth tables setup complete.");

    } catch (err) {
        console.error("Error setting up auth tables:", err);
    }
}

createAuthTables();
