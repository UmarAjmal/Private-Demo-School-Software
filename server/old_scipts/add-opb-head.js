/**
 * add-opb-head.js
 * ─────────────────────────────────────────────────────────────────────────
 * Adds 'Opening Balance' as a special fee head (head_type = 'opb') so it
 * can be linked to Fee Plans and auto-included in slip generation.
 * Also clears family_opb_payments for a fresh start (OPB now tracked via
 * fee slips / fee_payments, NOT standalone payments).
 *
 * Run once:  node add-opb-head.js
 */

const pool = require('./db');

async function addOPBHead() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert OPB fee head if it doesn't already exist
        const result = await client.query(`
            INSERT INTO fee_heads (head_name, head_type, frequency, description)
            VALUES ('Opening Balance', 'opb', 'monthly',
                    'Previous dues carried forward before software installation')
            ON CONFLICT DO NOTHING
            RETURNING head_id, head_name
        `);

        if (result.rows.length > 0) {
            console.log(`✅ "Opening Balance" fee head created  (ID: ${result.rows[0].head_id})`);
        } else {
            // Check if it already exists
            const existing = await client.query(
                `SELECT head_id FROM fee_heads WHERE head_type = 'opb' LIMIT 1`
            );
            if (existing.rows.length > 0) {
                console.log(`ℹ️  Opening Balance head already exists (ID: ${existing.rows[0].head_id})`);
            } else {
                console.log('⚠️  Duplicate head_name conflict check fee_heads table manually');
            }
        }

        // 2. Clear old standalone OPB payment records (fresh start payments now via fee slips)
        const del = await client.query('DELETE FROM family_opb_payments RETURNING payment_id');
        console.log(`🗑️  Cleared ${del.rowCount} old OPB payment record(s) from family_opb_payments`);

        // 3. Reset opening_balance_paid = 0 for all families (since we cleared history)
        const reset = await client.query(
            `UPDATE families SET opening_balance_paid = 0 WHERE opening_balance_paid != 0`
        );
        console.log(`🔄 Reset opening_balance_paid to 0 for ${reset.rowCount} family/families`);

        await client.query('COMMIT');

        console.log('\n✅ OPB Head migration complete!');
        console.log('─────────────────────────────────────────────────────────');
        console.log('   Next steps:');
        console.log('   1. Go to Fees → Fee Heads you will see "Opening Balance" head');
        console.log('   2. Open each Fee Plan → add "Opening Balance" head (set amount = 0,');
        console.log('      system auto-uses the family\'s actual remaining OPB at generation time)');
        console.log('   3. Generate slips OPB will be added as a line item on any slip');
        console.log('      for families who still have remaining opening balance');
        console.log('   4. Collect fee normally OPB reduces automatically as slips are paid');
        console.log('─────────────────────────────────────────────────────────');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

addOPBHead();
