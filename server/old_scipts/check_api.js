require('dotenv').config({path: '.env'});
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const month = 4;
const year = 2026;

pool.query(`
SELECT mfs.slip_id, s.first_name, s.last_name, c.class_name, sec.section_name, mfs.is_family_slip
            FROM monthly_fee_slips mfs
            JOIN students s ON mfs.student_id = s.student_id       
            LEFT JOIN classes c ON mfs.class_id = c.class_id       
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            WHERE mfs.month = $1 AND mfs.year = $2
            

`, [month, year])
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
