const pool = require('./db');

async function addFamilyFeeColumn() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('🔄 Upgrading families table with family_fee...');

        // 1. Add family_fee to families table
        await client.query(`
            ALTER TABLE families
            ADD COLUMN IF NOT EXISTS family_fee DECIMAL(10,2) NOT NULL DEFAULT 0;
        `);
        console.log('✅ families.family_fee column added');

        // 2. Seed family_fee from highest monthly_fee of members (for existing data)
        await client.query(`
            UPDATE families f
            SET family_fee = COALESCE((
                SELECT MAX(s.monthly_fee)
                FROM students s
                WHERE s.family_id = f.family_id
                  AND s.monthly_fee > 0
            ), 0)
            WHERE family_fee = 0;
        `);
        console.log('✅ Seeded existing family_fee from student monthly_fee values');

        // 3. Add is_family_slip column to monthly_fee_slips for clarity
        await client.query(`
            ALTER TABLE monthly_fee_slips
            ADD COLUMN IF NOT EXISTS is_family_slip BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        console.log('✅ monthly_fee_slips.is_family_slip column added');

        await client.query('COMMIT');
        console.log('');
        console.log('✅ Family fee migration complete!');
        console.log('   → families.family_fee: fee for entire family unit');
        console.log('   → monthly_fee_slips.is_family_slip: marks multi-member family slips');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

addFamilyFeeColumn();
