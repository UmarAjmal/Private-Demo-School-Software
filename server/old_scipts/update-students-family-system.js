const pool = require('./db');

const updateStudentsForFamilySystem = async () => {
    const client = await pool.connect();
    try {
        console.log("🔄 Updating Students Table for Family ID System...");
        
        await client.query('BEGIN');

        // Add family_id column if not exists
        await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS family_id VARCHAR(50),
            ADD COLUMN IF NOT EXISTS sibling_relation VARCHAR(20) DEFAULT 'blood' CHECK (sibling_relation IN ('blood', 'cousin'));
        `);

        // Create families tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS families (
                family_id VARCHAR(50) PRIMARY KEY,
                family_name VARCHAR(200),
                primary_contact_name VARCHAR(100),
                primary_contact_phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            );
        `);

        // Create sibling relationships table for explicit tracking
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_siblings (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
                sibling_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
                relation_type VARCHAR(20) CHECK (relation_type IN ('blood', 'cousin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, sibling_id)
            );
        `);

        // Create index for faster family_id lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_students_family_id ON students(family_id);
        `);

        // Generate family_id for existing students who don't have one
        // Format: FAM-YYYY-NNNN
        const year = new Date().getFullYear();
        
        const studentsWithoutFamily = await client.query(`
            SELECT student_id FROM students WHERE family_id IS NULL
        `);

        if (studentsWithoutFamily.rows.length > 0) {
            console.log(`📝 Generating Family IDs for ${studentsWithoutFamily.rows.length} existing students...`);
            
            for (const row of studentsWithoutFamily.rows) {
                // Find next available family number
                const lastFamily = await client.query(`
                    SELECT family_id FROM students 
                    WHERE family_id LIKE $1 
                    ORDER BY family_id DESC LIMIT 1
                `, [`FAM-${year}-%`]);

                let familyNum = 1;
                if (lastFamily.rows.length > 0) {
                    const lastId = lastFamily.rows[0].family_id;
                    const match = lastId.match(/FAM-\d{4}-(\d{4})/);
                    if (match) {
                        familyNum = parseInt(match[1]) + 1;
                    }
                }

                const newFamilyId = `FAM-${year}-${String(familyNum).padStart(4, '0')}`;
                
                await client.query(`
                    UPDATE students SET family_id = $1, sibling_relation = 'blood' 
                    WHERE student_id = $2
                `, [newFamilyId, row.student_id]);
            }
        }

        await client.query('COMMIT');
        console.log("✅ Students table updated successfully for Family ID system!");
        console.log("✅ Families table created!");
        console.log("✅ Student_siblings relationship table created!");
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error updating students table:", err.message);
    } finally {
        client.release();
        pool.end();
    }
};

updateStudentsForFamilySystem();
