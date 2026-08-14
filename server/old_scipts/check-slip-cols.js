const { Pool } = require('pg'); 
require('dotenv').config({ path: 'D:/peronal/SMS_Pern/server/.env' }); 
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); 
dbPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'monthly_fee_slips'").then(res => console.log(res.rows.map(r=>r.column_name))).catch(console.error).finally(()=>dbPool.end());