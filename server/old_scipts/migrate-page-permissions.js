/**
 * migrate-page-permissions.js
 *
 * Migrates role_permissions from module-level keys (e.g. 'students')
 * to page-level keys (e.g. 'students.admission', 'students.details').
 *
 * For every role, for every module it has a permission row for,
 * this script inserts one row per sub-page—inheriting the same
 * can_read / can_write / can_delete values.
 *
 * If a page-level row already exists it is SKIPPED (idempotent).
 * The old module-level rows are kept so legacy code still works.
 *
 * Run once:
 *   node server/migrate-page-permissions.js
 */

const db = require('./db');

/* ─────────────────────────────────────────────────────────────────────────
   PAGE TREE  must mirror the PAGE_TREE constant in the frontend roles page
───────────────────────────────────────────────────────────────────────── */
const PAGE_TREE = {
    dashboard: ['dashboard'],
    students: [
        'students.details',
        'students.admission',
        'students.import',
        'students.profile',
        'students.edit',
    ],
    academic: [
        'academic.classes',
        'academic.sections',
        'academic.subjects',
        'academic.teachers',
        'academic.promotion',
        'academic.examination',
        'academic.marks-sheet',
        'academic.result-card',
    ],
    hrm: [
        'hrm.departments',
        'hrm.employees',
    ],
    fees: [
        'fees.heads',
        'fees.plans',
        'fees.generate',
        'fees.collect',
        'fees.admission',
        'fees.opening-balance',
    ],
    expenses: [
        'expenses.categories',
        'expenses.list',
        'expenses.add',
    ],
    attendance: [
        'attendance.students',
        'attendance.staff',
        'attendance.students.history',
        'attendance.staff.history',
    ],
    reports: [
        'reports.students',
        'reports.results',
        'reports.expenses',
        'reports.family-fee',
    ],
    settings: [
        'settings.general',
        'settings.academic',
        'settings.system',
        'settings.users',
        'settings.roles',
    ],
};

async function migrate() {
    console.log('🔄  Starting page-level permission migration...\n');

    // 1. Fetch all roles
    const roles = await db.query('SELECT id, role_name FROM roles ORDER BY id');
    console.log(`Found ${roles.rows.length} role(s)\n`);

    let inserted = 0;
    let skipped = 0;

    for (const role of roles.rows) {
        console.log(`\n── Role #${role.id}: ${role.role_name}`);

        // 2. Fetch current permissions for this role
        const result = await db.query(
            'SELECT module_name, can_read, can_write, can_delete FROM role_permissions WHERE role_id = $1',
            [role.id]
        );
        const existing = result.rows;

        for (const [moduleKey, pageKeys] of Object.entries(PAGE_TREE)) {
            // Find module-level row (e.g. module_name = 'students')
            const moduleRow = existing.find(p => p.module_name === moduleKey);

            // Default values when no module-level row exists
            const base = moduleRow
                ? { can_read: moduleRow.can_read, can_write: moduleRow.can_write, can_delete: moduleRow.can_delete }
                : { can_read: false, can_write: false, can_delete: false };

            for (const pageKey of pageKeys) {
                // Check if page-level row already exists
                const alreadyExists = existing.find(p => p.module_name === pageKey);
                if (alreadyExists) {
                    console.log(`   ↷  SKIP  ${pageKey} (already exists)`);
                    skipped++;
                    continue;
                }

                // Insert page-level row inheriting from parent module
                await db.query(
                    `INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [role.id, pageKey, base.can_read, base.can_write, base.can_delete]
                );
                console.log(`   ✓  INSERT ${pageKey}  (read=${base.can_read} write=${base.can_write} delete=${base.can_delete})`);
                inserted++;
            }
        }
    }

    console.log(`\n✅  Migration complete.`);
    console.log(`   Inserted : ${inserted} page-level permission rows`);
    console.log(`   Skipped  : ${skipped} (already existed)`);
    console.log(`\nNote: Old module-level rows (e.g. 'students') were kept for backward compatibility.`);
    console.log(`      You may remove them once you confirm the new system works correctly.\n`);

    process.exit(0);
}

migrate().catch(err => {
    console.error('\n❌  Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
});
