const pool = require('./db');

async function check() {
    try {
        const { rows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'teacher_class_assignment'");
        console.log('teacher_class_assignment:', rows.map(r => r.column_name));
        
        const { rows: rows2 } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subject_teachers'");
        console.log('subject_teachers:', rows2.map(r => r.column_name));
        
        const { rows: rows3 } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subjects'");
        console.log('subjects:', rows3.map(r => r.column_name));
    } catch(err) {
        console.error(err);
    }
    process.exit();
}
check();