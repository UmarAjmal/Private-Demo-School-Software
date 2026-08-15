const pool = require('./db');

async function checkClasses() {
    try {
        // Check Class 1
        const result1 = await pool.query(`
            SELECT c.class_id, c.class_name, s.section_id, s.section_name 
            FROM classes c 
            LEFT JOIN sections s ON c.class_id = s.class_id 
            WHERE c.class_name = 'Class 1' 
            ORDER BY c.class_id, s.section_id
        `);
        
        console.log('\n📚 Class 1 & Sections:');
        if (result1.rows.length === 0) {
            console.log('❌ Class 1 NOT FOUND!');
        } else {
            console.table(result1.rows);
        }

        // Check Class 2
        const result2 = await pool.query(`
            SELECT c.class_id, c.class_name, s.section_id, s.section_name 
            FROM classes c 
            LEFT JOIN sections s ON c.class_id = s.class_id 
            WHERE c.class_name = 'Class 2' 
            ORDER BY c.class_id, s.section_id
        `);
        
        console.log('\n📚 Class 2 & Sections:');
        if (result2.rows.length === 0) {
            console.log('❌ Class 2 NOT FOUND!');
        } else {
            console.table(result2.rows);
            const hasRed = result2.rows.some(r => r.section_name === 'Red');
            if (!hasRed) {
                console.log('\n⚠️  Section Red not found!');
            } else {
                console.log('\n✅ Class 2, Section Red exists - Ready!');
            }
        }
        
        pool.end();
    } catch (err) {
        console.error('Error:', err.message);
        pool.end();
    }
}

checkClasses();
