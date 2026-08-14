require('dotenv').config({path: '.env'});
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.query(`SELECT s.first_name, s.family_id, sec.section_name, s.status FROM students s LEFT JOIN sections sec ON s.section_id = sec.section_id `)
  .then(r => { console.log(r.rows.filter(s => ['FAM-2026-0015', 'FAM-2026-0011', 'FAM-2026-0008'].includes(s.family_id))); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
