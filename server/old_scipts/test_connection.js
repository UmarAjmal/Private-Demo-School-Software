require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection Error:', err);
  } else {
    console.log('Successfully connected to Supabase!');
    console.log('Current Time:', res.rows[0].now);
  }
  pool.end();
});
