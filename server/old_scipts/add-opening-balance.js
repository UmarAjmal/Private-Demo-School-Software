/**
 * Migration: Add Opening Balance (OPB) system to families
 * 
 * Adds:
 *   - families.opening_balance       original OPB amount set by admin
 *   - families.opening_balance_paid  total amount paid towards OPB so far
 *   - family_opb_payments table      ledger of all OPB payment transactions
 */

const pool = require('./db');

async function addOpeningBalance() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('🔄 Adding Opening Balance system...');

        // 1. Add opening_balance column to families
        await client.query(`
            ALTER TABLE families
            ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS opening_balance_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS opb_notes TEXT;
        `);
        console.log('✅ families.opening_balance, opening_balance_paid, opb_notes columns added');

        // 2. Create OPB payments ledger table
        await client.query(`
            CREATE TABLE IF NOT EXISTS family_opb_payments (
                payment_id    SERIAL PRIMARY KEY,
                family_id     VARCHAR(50) NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
                amount        DECIMAL(10,2) NOT NULL CHECK(amount > 0),
                payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
                payment_method VARCHAR(30) DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','cheque','online','other')),
                received_by   VARCHAR(100),
                reference_no  VARCHAR(100),
                notes         TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ family_opb_payments table created');

        // 3. Index for fast family lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_opb_payments_family
            ON family_opb_payments(family_id);
        `);
        console.log('✅ Index on family_opb_payments(family_id) created');

        await client.query('COMMIT');
        console.log('');
        console.log('✅ Opening Balance migration complete!');
        console.log('   → families.opening_balance      : original OPB amount');
        console.log('   → families.opening_balance_paid : total paid towards OPB');
        console.log('   → family_opb_payments           : full payment ledger');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

addOpeningBalance();
