require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    // Check tables
    const tables = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('\n=== TABLES IN LIVE DB ===');
    tables.rows.forEach(r => console.log(' -', r.table_name));

    // Check students
    const students = await p.query('SELECT student_id, first_name, status, class_id FROM students LIMIT 20');
    console.log('\n=== STUDENTS (first 20) ===');
    console.log('Count:', students.rows.length);
    console.table(students.rows);

    // Check classes
    const classes = await p.query('SELECT class_id, class_name FROM classes LIMIT 10');
    console.log('\n=== CLASSES ===');
    console.table(classes.rows);

    // Check fee plans
    const plans = await p.query('SELECT plan_id, plan_name, class_id, is_active, applies_to_all FROM fee_plans LIMIT 10');
    console.log('\n=== FEE PLANS ===');
    console.table(plans.rows);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    p.end();
  }
}

main();
