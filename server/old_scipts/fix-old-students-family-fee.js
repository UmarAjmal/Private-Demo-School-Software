/**
 * fix-old-students-family-fee.js
 * Migration: Ensure ALL existing students are correctly migrated to the
 * family fee system. Run once from server/ directory.
 *
 * What it does:
 *  1. Creates missing `families` records for every unique family_id in students
 *  2. For multi-member families where family_fee = 0, seeds it from SUM of members' monthly_fee
 *  3. Reports families that still need manual fee entry
 *  4. Reports solo-student families (no action needed they use individual monthly_fee)
 */

const pool = require('./db');

async function fixOldStudentFamilyFees() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── Step 1: Create families records for family_ids not yet in families table ──
        const orphanResult = await client.query(`
            INSERT INTO families (family_id, family_fee, created_at)
            SELECT DISTINCT s.family_id, 0, NOW()
            FROM students s
            WHERE s.family_id IS NOT NULL
            ON CONFLICT (family_id) DO NOTHING
            RETURNING family_id
        `);
        console.log(`✅ Step 1: Created ${orphanResult.rows.length} missing families records`);

        // ── Step 2: Find all multi-member families ────────────────────────────────────
        // family_size = number of Active students in that family
        const familyStats = await client.query(`
            SELECT f.family_id, f.family_fee,
                   COUNT(s.student_id) AS member_count,
                   COALESCE(SUM(s.monthly_fee), 0) AS total_monthly_fee,
                   COALESCE(MAX(s.monthly_fee), 0) AS max_monthly_fee,
                   STRING_AGG(s.first_name || ' ' || s.last_name || ' (Rs.' || COALESCE(s.monthly_fee,0) || ')', ', ') AS members_info
            FROM families f
            JOIN students s ON s.family_id = f.family_id AND s.status = 'Active'
            GROUP BY f.family_id, f.family_fee
            HAVING COUNT(s.student_id) > 1
            ORDER BY COUNT(s.student_id) DESC
        `);

        console.log(`\n📊 Multi-member families found: ${familyStats.rows.length}`);

        let seededCount = 0;
        let alreadySetCount = 0;
        let noFeeCount = 0;

        for (const fam of familyStats.rows) {
            if (parseFloat(fam.family_fee) > 0) {
                // Already has a family fee set
                alreadySetCount++;
                console.log(`   ✓ ${fam.family_id} (${fam.member_count} members): Rs.${fam.family_fee} already set [${fam.members_info}]`);
            } else if (parseFloat(fam.total_monthly_fee) > 0) {
                // Seed from SUM of individual monthly_fees (most logical: family pays sum of all children's fees)
                const newFee = parseFloat(fam.total_monthly_fee);
                await client.query(`
                    UPDATE families SET family_fee = $1 WHERE family_id = $2
                `, [newFee, fam.family_id]);
                seededCount++;
                console.log(`   🔄 ${fam.family_id} (${fam.member_count} members): Seeded Rs.${newFee} [${fam.members_info}]`);
            } else {
                // All members have monthly_fee = 0; admin needs to set manually
                noFeeCount++;
                console.log(`   ⚠️  ${fam.family_id} (${fam.member_count} members): No fee data set manually! [${fam.members_info}]`);
            }
        }

        console.log(`\n📈 Summary:`);
        console.log(`   • Multi-member families total: ${familyStats.rows.length}`);
        console.log(`   • Already had family_fee set:  ${alreadySetCount}`);
        console.log(`   • Seeded from individual fees: ${seededCount}`);
        console.log(`   • Needs manual fee entry:      ${noFeeCount}`);

        // ── Step 3: Report solo-student families (informational only) ─────────────────
        const soloFamilies = await client.query(`
            SELECT COUNT(DISTINCT s.family_id) AS solo_count
            FROM students s
            JOIN families f ON f.family_id = s.family_id
            WHERE s.status = 'Active'
            GROUP BY s.family_id
            HAVING COUNT(s.student_id) = 1
        `);
        console.log(`   • Solo-student families (use personal monthly_fee): ${soloFamilies.rows.length}`);

        // ── Step 4: Verify final state ────────────────────────────────────────────────
        const verification = await client.query(`
            SELECT 
                COUNT(DISTINCT f.family_id) AS total_families,
                COUNT(DISTINCT CASE WHEN f.family_fee > 0 THEN f.family_id END) AS families_with_fee,
                COUNT(DISTINCT CASE WHEN f.family_fee = 0 THEN f.family_id END) AS families_zero_fee
            FROM families f
            JOIN students s ON s.family_id = f.family_id AND s.status = 'Active'
        `);
        const v = verification.rows[0];
        console.log(`\n✅ Final State:`);
        console.log(`   • Total families with active members: ${v.total_families}`);
        console.log(`   • Families with fee set (> 0):        ${v.families_with_fee}`);
        console.log(`   • Families still at zero fee:         ${v.families_zero_fee}`);

        await client.query('COMMIT');
        console.log('\n✅ Old student family fee fix complete!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        console.error(err);
    } finally {
        client.release();
        process.exit(0);
    }
}

fixOldStudentFamilyFees();
