require('dotenv').config();
const pool = require('./db');

// All tables that SHOULD exist after master-seeder runs
const EXPECTED_TABLES = [
    // Auth & Settings
    { name: 'app_roles', critical: true, desc: 'User roles (Admin, Teacher, etc.)' },
    { name: 'role_permissions', critical: true, desc: 'Permissions per role' },
    { name: 'app_users', critical: true, desc: 'Login users' },
    { name: 'user_sessions', critical: true, desc: 'Active user login sessions & 24H persistence' },
    { name: 'school_settings', critical: true, desc: 'School name, logo, etc.' },
    { name: 'system_settings', critical: true, desc: 'Backup & system config' },
    // Academic Structure
    { name: 'classes', critical: true, desc: 'Class list (KG, 1, 2...)' },
    { name: 'sections', critical: true, desc: 'Sections per class (A, B...)' },
    { name: 'subjects', critical: true, desc: 'Subject list' },
    { name: 'academic_years', critical: true, desc: 'Academic years (2024-2025...)' },
    { name: 'academic_terms', critical: true, desc: 'Terms per academic year' },
    // Students
    { name: 'students', critical: true, desc: 'Student records' },
    { name: 'student_academic_records', critical: true, desc: 'Student promotions/results' },
    { name: 'families', critical: true, desc: 'Family groupings' },
    { name: 'student_siblings', critical: true, desc: 'Sibling relationships' },
    // HRM / Employees
    { name: 'departments', critical: true, desc: 'HR departments' },
    { name: 'employees', critical: true, desc: 'Employee records' },
    { name: 'teacher_subject_assignment', critical: true, desc: 'Which teacher teaches what' },
    { name: 'teacher_class_assignment', critical: true, desc: 'Class teacher assignments' },
    // Attendance
    { name: 'student_attendance', critical: true, desc: 'Student daily attendance' },
    { name: 'staff_attendance', critical: true, desc: 'Staff daily attendance' },
    // Expenses
    { name: 'expense_categories', critical: true, desc: 'Expense category list' },
    { name: 'expenses', critical: true, desc: 'Expense records' },
    // Fees
    { name: 'fee_heads', critical: true, desc: 'Fee types (Tuition, Exam...)' },
    { name: 'fee_plans', critical: true, desc: 'Fee plan groups' },
    { name: 'fee_plan_classes', critical: true, desc: 'Which classes are in which plan' },
    { name: 'fee_plan_heads', critical: true, desc: 'Fee amounts per plan/head' },
    { name: 'monthly_fee_slips', critical: true, desc: 'Generated monthly fee slips' },
    { name: 'slip_line_items', critical: true, desc: 'Individual line items per slip' },
    { name: 'fee_payments', critical: true, desc: 'Fee payment records' },
    { name: 'family_opb_payments', critical: true, desc: 'Opening balance payment ledger' },
    { name: 'admission_fee_ledger', critical: true, desc: 'Admission fee outstanding' },
    { name: 'admission_fee_payments', critical: true, desc: 'Admission fee payments' },
    { name: 'exam_fee_collections', critical: true, desc: 'Exam fee collection records' },
    // Examinations
    { name: 'exam_marks', critical: false, desc: 'Exam marks per student' },
    { name: 'exam_mark_locks', critical: false, desc: 'Lock state for exam marks entry' },
    { name: 'test_papers', critical: false, desc: 'Test papers definition' },
    { name: 'test_marks', critical: false, desc: 'Test marks per student' },
    { name: 'test_paper_locks', critical: false, desc: 'Lock state for test marks' },
    { name: 'exam_sheet_approvals', critical: false, desc: 'Exam & test sheet approval workflow' },
    { name: 'user_direct_permissions', critical: false, desc: 'Direct user permission overrides' },
    { name: 'role_audit_log', critical: false, desc: 'Role & permission change audit logs' },
    // Notifications & Mobile Engine
    { name: 'notifications', critical: true, desc: 'Persistent multi-role & mobile notifications' },
];

// Critical columns to verify on key tables
const CRITICAL_COLUMNS = {
    // Auth
    app_roles: ['id', 'role_name', 'role_level', 'is_custom', 'is_system_default', 'dashboard_access'],
    app_users: ['id', 'username', 'password_hash', 'role_id', 'is_active', 'failed_login_attempts', 'locked_until'],
    user_sessions: ['session_id', 'user_id', 'session_token', 'remember_me', 'expires_at', 'is_revoked'],
    // Students
    students: ['student_id', 'first_name', 'class_id', 'section_id', 'family_id', 'status'],
    families: ['family_id', 'family_fee', 'opening_balance', 'opening_balance_paid'],
    student_academic_records: ['id', 'student_id', 'academic_year_id', 'class_id', 'promotion_target_year_id', 'promoted_at'],
    // Academic
    academic_years: ['id', 'year_name', 'is_active', 'status', 'is_configured'],
    academic_terms: ['id', 'academic_year_id', 'has_summer_work', 'has_winter_work'],
    // HRM
    employees: ['employee_id', 'first_name', 'last_name', 'cnic', 'status', 'app_user_id'],
    // Expenses
    expense_categories: ['category_id', 'category_name', 'is_active', 'updated_at'],
    expenses: ['expense_id', 'category_id', 'expense_title', 'amount', 'status', 'updated_at'],
    // Fees
    fee_heads: ['head_id', 'head_name', 'head_type', 'frequency', 'is_active'],
    fee_plans: ['plan_id', 'plan_name', 'applies_to_all'],
    monthly_fee_slips: ['slip_id', 'is_printed', 'printed_at', 'is_family_slip', 'has_multi_months', 'months_list'],
    fee_payments: ['payment_id', 'slip_id', 'amount_paid', 'is_printed', 'printed_at'],
    admission_fee_ledger: ['ledger_id', 'student_id', 'total_amount', 'paid_amount', 'discount', 'discount_amount', 'status'],
    admission_fee_payments: ['payment_id', 'ledger_id', 'amount_paid', 'discount_amount'],
    // Examinations
    exam_marks: ['mark_id', 'student_id', 'subject_id', 'term_id', 'total_marks', 'obtained_marks', 'status', 'updated_at'],
    test_papers: ['test_id', 'test_name', 'class_id', 'total_marks', 'status', 'approved_by', 'published_by'],
    test_marks: ['test_mark_id', 'test_id', 'student_id', 'obtained_marks', 'is_absent'],
    exam_sheet_approvals: ['id', 'sheet_type', 'class_id', 'section_id', 'status', 'submitted_by', 'approved_by', 'published_by', 'updated_at'],
    // Notifications
    notifications: ['id', 'user_id', 'family_id', 'role', 'type', 'title', 'message', 'is_read'],
};

async function runFullCheck() {
    const client = await pool.connect();
    console.log('\n══════════════════════════════════════════════════════');
    console.log('   SUPABASE DATABASE FULL HEALTH CHECK');
    console.log('══════════════════════════════════════════════════════\n');

    try {
        // 1. Get all existing tables from database
        const existingRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        const existingTables = new Set(existingRes.rows.map(r => r.table_name));

        console.log(`📋 Total tables found in Supabase: ${existingTables.size}`);
        console.log('─'.repeat(54));

        // 2. Check each expected table
        const missing = [];
        const present = [];

        for (const t of EXPECTED_TABLES) {
            if (existingTables.has(t.name)) {
                present.push(t);
            } else {
                missing.push(t);
            }
        }

        // 3. Print present tables with row counts
        console.log('\n✅ PRESENT TABLES (with row counts):');
        console.log('─'.repeat(54));
        for (const t of present) {
            const countRes = await client.query(`SELECT COUNT(*) as cnt FROM ${t.name};`);
            const count = parseInt(countRes.rows[0].cnt);
            const flag = count === 0 ? '  ⚠️  (empty)' : `  → ${count} rows`;
            const critTag = t.critical ? '' : ' [optional]';
            console.log(`  ✓ ${t.name.padEnd(32)} ${flag}${critTag}`);
        }

        // 4. Print missing tables
        if (missing.length > 0) {
            console.log('\n❌ MISSING TABLES:');
            console.log('─'.repeat(54));
            for (const t of missing) {
                const critTag = t.critical ? '  🚨 CRITICAL' : '  [optional]';
                console.log(`  ✗ ${t.name.padEnd(32)} ${critTag}`);
                console.log(`    └─ ${t.desc}`);
            }
        } else {
            console.log('\n✅ All expected tables are present!');
        }

        // 5. Check extra tables (not in expected list)
        const expectedNames = new Set(EXPECTED_TABLES.map(t => t.name));
        const extraTables = [...existingTables].filter(t => !expectedNames.has(t));
        if (extraTables.length > 0) {
            console.log('\n📌 EXTRA TABLES (not in expected list, probably fine):');
            console.log('─'.repeat(54));
            extraTables.forEach(t => console.log(`  ~ ${t}`));
        }

        // 6. Verify critical columns
        console.log('\n🔍 CRITICAL COLUMN CHECKS:');
        console.log('─'.repeat(54));
        for (const [tableName, cols] of Object.entries(CRITICAL_COLUMNS)) {
            if (!existingTables.has(tableName)) {
                console.log(`  ⚠️  ${tableName}: TABLE MISSING, skipping column check`);
                continue;
            }
            const colRes = await client.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1;
            `, [tableName]);
            const existingCols = new Set(colRes.rows.map(r => r.column_name));
            const missingCols = cols.filter(c => !existingCols.has(c));
            if (missingCols.length === 0) {
                console.log(`  ✓ ${tableName}: all required columns present`);
            } else {
                console.log(`  ✗ ${tableName}: MISSING COLUMNS → ${missingCols.join(', ')}`);
            }
        }

        // 7. Key data checks
        console.log('\n📊 KEY DATA VERIFICATION:');
        console.log('─'.repeat(54));

        // Admin user check
        if (existingTables.has('app_users')) {
            const adminRes = await client.query(`SELECT username, is_active FROM app_users WHERE username IN ('admin', 'root');`);
            if (adminRes.rows.length === 0) {
                console.log('  ⚠️  No admin/root user found! Login will fail.');
            } else {
                adminRes.rows.forEach(u => {
                    console.log(`  ✓ User "${u.username}" exists (active: ${u.is_active})`);
                });
            }
        }

        // Admin role check
        if (existingTables.has('app_roles')) {
            const rolesRes = await client.query(`SELECT role_name, role_level FROM app_roles ORDER BY role_level DESC;`);
            console.log(`  ✓ ${rolesRes.rows.length} roles seeded:`);
            rolesRes.rows.forEach(r => {
                console.log(`    → ${r.role_name.padEnd(20)} level: ${r.role_level ?? 'NULL ⚠️'}`);
            });
        }

        // Fee heads check
        if (existingTables.has('fee_heads')) {
            const fhRes = await client.query(`SELECT head_name, head_type FROM fee_heads ORDER BY head_id;`);
            console.log(`  ✓ ${fhRes.rows.length} fee heads seeded:`);
            fhRes.rows.forEach(h => console.log(`    → ${h.head_name} (${h.head_type})`));
        }

        // Expense categories check
        if (existingTables.has('expense_categories')) {
            const ecRes = await client.query(`SELECT COUNT(*) as cnt FROM expense_categories;`);
            const cnt = parseInt(ecRes.rows[0].cnt);
            if (cnt === 0) {
                console.log('  ⚠️  expense_categories is empty! Run create-expenses-tables.sql again.');
            } else {
                console.log(`  ✓ ${cnt} expense categories seeded`);
            }
        }

        // Academic years check
        if (existingTables.has('academic_years')) {
            const ayRes = await client.query(`SELECT COUNT(*) as cnt FROM academic_years;`);
            console.log(`  ✓ ${ayRes.rows[0].cnt} academic years seeded`);
        }

        // School settings check
        if (existingTables.has('school_settings')) {
            const ssRes = await client.query(`SELECT school_name FROM school_settings LIMIT 1;`);
            if (ssRes.rows.length > 0) {
                console.log(`  ✓ School settings present (name: "${ssRes.rows[0].school_name}")`);
            } else {
                console.log('  ⚠️  school_settings table is empty!');
            }
        }

        // Summary
        console.log('\n══════════════════════════════════════════════════════');
        const criticalMissing = missing.filter(t => t.critical);
        if (criticalMissing.length === 0 && missing.length === 0) {
            console.log('🎉 DATABASE STATUS: FULLY HEALTHY All tables present!');
        } else if (criticalMissing.length > 0) {
            console.log(`🚨 DATABASE STATUS: ${criticalMissing.length} CRITICAL TABLE(S) MISSING!`);
            console.log('   Run: node master-seeder.js to fix this.');
        } else {
            console.log(`⚠️  DATABASE STATUS: ${missing.length} optional table(s) missing (non-critical).`);
        }
        console.log('══════════════════════════════════════════════════════\n');

    } catch (err) {
        console.error('❌ Health check failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runFullCheck();
