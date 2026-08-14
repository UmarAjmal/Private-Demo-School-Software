const pool = require('./db');

async function runEssentialMigrations() {
    const client = await pool.connect();
    try {
        console.log("🚀 Running essential database migrations...");
        await client.query('BEGIN');

        // 1. Academic Terms Migration
        console.log("   → Checking academic_terms columns...");
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_terms' AND column_name='has_summer_work') THEN
                    ALTER TABLE academic_terms ADD COLUMN has_summer_work BOOLEAN DEFAULT FALSE;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_terms' AND column_name='has_winter_work') THEN
                    ALTER TABLE academic_terms ADD COLUMN has_winter_work BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);

        // 2. Fee Plans Migration
        console.log("   → Checking fee_plans columns...");
        await client.query(`
            ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN DEFAULT FALSE;
        `);

        // 3. Print Tracking Migration
        console.log("   → Checking monthly_fee_slips columns...");
        await client.query(`
            ALTER TABLE monthly_fee_slips 
            ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP;
        `);

        await client.query('COMMIT');
        console.log("✅ All essential migrations completed successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err.message);
        // We don't exit process here because we want the server to try and start anyway
    } finally {
        client.release();
    }
}

module.exports = { runEssentialMigrations };
