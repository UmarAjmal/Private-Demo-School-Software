const pool = require('./db');

(async () => {
  try {
    const res = await pool.query(`
      SELECT e.employee_id, e.first_name, e.designation, d.department_name 
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.department_id
    `);
    console.log("All Employees:", res.rows);
    
    // Check if any match 'Teacher' or 'Teaching Staff'
    const teachers = res.rows.filter(r => 
        (r.designation && r.designation.toLowerCase().includes('teacher')) || 
        (r.department_name && r.department_name === 'Teaching Staff')
    );
    console.log("Matching Teachers:", teachers.length);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
})();
