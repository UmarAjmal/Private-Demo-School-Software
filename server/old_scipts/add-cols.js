const { Pool } = require('pg'); 
require('dotenv').config({ path: 'D:/peronal/SMS_Pern/server/.env' }); 
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); 
async function addCol() { 
    try { 
        await dbPool.query('ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN DEFAULT false;'); 
        console.log('Added applies_to_all column.'); 
        await dbPool.query('CREATE TABLE IF NOT EXISTS fee_plan_classes (id SERIAL PRIMARY KEY, plan_id INTEGER REFERENCES fee_plans(plan_id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(class_id) ON DELETE CASCADE, UNIQUE(plan_id, class_id));'); 
        console.log('Verified fee_plan_classes table exists.'); 
    } catch(e) { 
        console.error(e); 
    } finally { 
        dbPool.end(); 
    } 
} 
addCol();
