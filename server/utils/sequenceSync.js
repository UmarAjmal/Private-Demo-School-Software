const pool = require('../db');

/**
 * Synchronizes all PostgreSQL primary key sequences with the current MAX(column) value in each table.
 * This prevents "duplicate key value violates unique constraint" errors after database backup restores.
 */
async function syncAllSequences(clientOrPool = pool) {
    try {
        console.log("🔄 Synchronizing PostgreSQL primary key sequences with MAX(id)...");
        await clientOrPool.query(`
            DO $$
            DECLARE
                rec RECORD;
                max_val BIGINT;
                sql_stmt TEXT;
            BEGIN
                FOR rec IN
                    SELECT 
                        tc.table_name, 
                        kcu.column_name, 
                        pg_get_serial_sequence(tc.table_name, kcu.column_name) AS seq_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name 
                        AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY' 
                      AND tc.table_schema = 'public'
                LOOP
                    IF rec.seq_name IS NOT NULL THEN
                        sql_stmt := format('SELECT COALESCE(MAX(%I), 0) FROM %I', rec.column_name, rec.table_name);
                        EXECUTE sql_stmt INTO max_val;
                        IF max_val > 0 THEN
                            PERFORM setval(rec.seq_name, max_val, true);
                        END IF;
                    END IF;
                END LOOP;
            END $$;
        `);
        console.log("✅ All PostgreSQL sequences successfully synchronized.");
        return { success: true };
    } catch (err) {
        console.error("⚠️ Sequence synchronization warning:", err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { syncAllSequences };
