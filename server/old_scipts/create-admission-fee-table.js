const pool = require('./db');

async function createAdmissionFeeTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Creating Admission Fee tables...');

        // 1. Admission Fee Ledger one row per student, tracks lifetime admission fee outstanding
        await client.query(`
            CREATE TABLE IF NOT EXISTS admission_fee_ledger (
                ledger_id   SERIAL PRIMARY KEY,
                student_id  INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
                paid_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
                discount_amount DECIMAL(10,2) DEFAULT 0,
                status         VARCHAR(20)   NOT NULL DEFAULT 'unpaid',
                -- unpaid | partial | paid
                admission_date DATE,
                notes       TEXT,
                created_at  TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id)   -- Each student has exactly one ledger entry
            );
        `);
        console.log('✅ admission_fee_ledger created');

        // 2. Admission Fee Payments payment history against a ledger entry
        await client.query(`
            CREATE TABLE IF NOT EXISTS admission_fee_payments (
                payment_id     SERIAL PRIMARY KEY,
                ledger_id      INTEGER NOT NULL REFERENCES admission_fee_ledger(ledger_id) ON DELETE CASCADE,
                amount_paid    DECIMAL(10,2) NOT NULL,
                discount_amount DECIMAL(10,2) DEFAULT 0,
                payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
                payment_method VARCHAR(30) DEFAULT 'cash',
                -- cash | bank | online | cheque
                received_by    VARCHAR(100),
                reference_no   VARCHAR(100),
                notes          TEXT,
                created_at     TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ admission_fee_payments created');

        // 3. Backfill existing students who already have admission_fee > 0
        //    (Only runs if there are students already in DB)
        const backfill = await client.query(`
            INSERT INTO admission_fee_ledger (student_id, total_amount, paid_amount, status, admission_date)
            SELECT 
                student_id,
                COALESCE(admission_fee, 0)  AS total_amount,
                0                           AS paid_amount,
                CASE WHEN COALESCE(admission_fee, 0) = 0 THEN 'paid' ELSE 'unpaid' END AS status,
                admission_date
            FROM students
            WHERE COALESCE(admission_fee, 0) > 0
            ON CONFLICT (student_id) DO NOTHING
        `);
        console.log(`✅ Backfilled ${backfill.rowCount} existing students into admission_fee_ledger`);

        await client.query('COMMIT');
        console.log('\n🎉 All admission fee tables created successfully!');
        console.log('');
        console.log('Tables created:');
        console.log('  • admission_fee_ledger        outstanding balance per student');
        console.log('  • admission_fee_payments      payment history per ledger entry');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

createAdmissionFeeTables();
