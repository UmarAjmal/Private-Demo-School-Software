require('dotenv').config();
const pool = require('./db');
const { syncAllSequences } = require('./utils/sequenceSync');

/**
 * Safe Transactional Data Reset Script
 * Removes data rows from student, fee, attendance, exam, and notification tables
 * while keeping all table schemas, structures, configurations, and user accounts 100% intact.
 */
async function cleanTransactionalData() {
    const client = await pool.connect();
    console.log("======================================================");
    console.log("   SAFE DATABASE TRANSACTIONAL DATA WIPE SCRIPT       ");
    console.log("======================================================\n");

    const TARGET_TABLES = [
        'student_siblings',
        'student_attendance',
        'student_academic_records',
        'staff_attendance',
        'slip_line_items',
        'notifications',
        'fee_payments',
        'monthly_fee_slips',
        'family_opb_payments',
        'admission_fee_payments',
        'admission_fee_ledger',
        'exam_fee_collections',
        'expenses',
        'test_marks',
        'test_paper_locks',
        'test_papers',
        'exam_marks',
        'exam_mark_locks',
        'exam_sheet_approvals',
        'students',
        'families'
    ];

    try {
        await client.query('BEGIN');
        console.log("🧹 Clearing data from specified 21 transactional tables...");

        for (const table of TARGET_TABLES) {
            await client.query(`TRUNCATE TABLE ${table} CASCADE;`);
            console.log(`   ✓ Truncated data from table: ${table}`);
        }

        await client.query('COMMIT');
        console.log("\n✅ All row data successfully removed from target tables.");

        // Reset and synchronize primary key sequences
        await syncAllSequences(client);

        console.log("\n======================================================");
        console.log("   DATA CLEANUP COMPLETED (TABLE SCHEMAS 100% INTACT)");
        console.log("======================================================\n");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Data cleanup error:", err.message);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    cleanTransactionalData()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { cleanTransactionalData };
