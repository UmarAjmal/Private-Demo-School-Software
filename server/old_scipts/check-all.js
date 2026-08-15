const pool = require('./db');
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;").then(res => { console.log('TABLES IN SUPABASE:'); console.log(res.rows.map(r => r.table_name).join(', ')); process.exit(0); }).catch(console.error);
