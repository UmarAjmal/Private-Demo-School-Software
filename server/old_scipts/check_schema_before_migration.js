const pool = require('./db');

async function checkSchema() {
    try {
        console.log('Checking current app_roles schema...\n');
        
        const res = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'app_roles'
            ORDER BY ordinal_position
        `);

        if (res.rows.length === 0) {
            console.log('❌ app_roles table does not exist!');
            process.exit(1);
        }

        console.log('Current app_roles columns:');
        res.rows.forEach(r => {
            console.log(`  ✓ ${r.column_name.padEnd(20)} ${r.data_type.padEnd(10)} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${r.column_default ? `(default: ${r.column_default})` : ''}`);
        });

        console.log('\n--- Checking for new columns that need to be added ---');
        const hasRoleLevel = res.rows.find(r => r.column_name === 'role_level');
        const hasIsCustom = res.rows.find(r => r.column_name === 'is_custom');

        console.log(`role_level column: ${hasRoleLevel ? '✓ EXISTS' : '✗ NEEDS TO BE ADDED'}`);
        console.log(`is_custom column: ${hasIsCustom ? '✓ EXISTS' : '✗ NEEDS TO BE ADDED'}`);

        if (!hasRoleLevel || !hasIsCustom) {
            console.log('\n✓ Migration needed. Proceeding...\n');
        } else {
            console.log('\n✓ Columns already exist. Migration may have already run.\n');
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
        await pool.end();
        process.exit(1);
    }
}

checkSchema();
