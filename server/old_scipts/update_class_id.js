const pool = require('./db');

async function updateClassId() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Inserting class_id 1...');
        await client.query("UPDATE classes SET class_name = 'Reception_Temp' WHERE class_id = 14");
        await client.query(`
            INSERT INTO classes (class_id, class_name, description, created_at)
            SELECT 1, 'Reception', description, created_at
            FROM classes
            WHERE class_id = 14
            ON CONFLICT (class_id) DO NOTHING;
        `);

        // Find all tables that have class_id column
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.columns 
            WHERE column_name = 'class_id' 
              AND table_schema = 'public'
              AND table_name != 'classes';
        `);
        const tables = result.rows.map(r => r.table_name);

        for (const table of tables) {
            console.log(`Updating ${table}...`);
            try {
                await client.query(`UPDATE ${table} SET class_id = 1 WHERE class_id = 14`);
            } catch (err) {
                console.log(`Failed to update ${table}: ${err.message}`);
            }
        }
        
        // console.log(`Updating promoted_to_class_id in student_records...`);
        // await client.query(`UPDATE student_records SET promoted_to_class_id = 1 WHERE promoted_to_class_id = 14`);

        console.log('Deleting class_id 14...');
        await client.query('DELETE FROM classes WHERE class_id = 14');

        await client.query('COMMIT');
        console.log('Successfully updated class_id from 14 to 1');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating class_id:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

updateClassId();
