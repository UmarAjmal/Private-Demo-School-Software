const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting Phase 2 Database Migration...\n');

        // Read migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', '001_add_role_level.sql');
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }

        let sqlContent = fs.readFileSync(migrationPath, 'utf8');
        
        // Clean up SQL: remove comments and split by statements
        const statements = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
            .join('\n')
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0)
            .map(stmt => stmt + ';');

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            const stmtNum = i + 1;

            try {
                console.log(`[${stmtNum}/${statements.length}] Executing...`);
                console.log(`  ${stmt.substring(0, 70)}${stmt.length > 70 ? '...' : ''}\n`);
                
                await client.query(stmt);
                console.log(`  ✅ Success\n`);
            } catch (err) {
                // Some statements might fail if they already exist (e.g., CREATE IF NOT EXISTS)
                // Only warn, don't stop
                if (err.message.includes('already exists') || err.message.includes('duplicate')) {
                    console.log(`  ⚠️  Warning: ${err.message}\n`);
                } else {
                    throw err;
                }
            }
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\n--- Verifying new columns ---');
        
        const verifyRes = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'app_roles'
            ORDER BY ordinal_position
        `);

        console.log('\nUpdated app_roles columns:');
        verifyRes.rows.forEach(r => {
            console.log(`  ✓ ${r.column_name.padEnd(20)} ${r.data_type}`);
        });

        console.log('\n🎉 Phase 2 Migration Complete!');
        
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        console.error('\nError details:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
