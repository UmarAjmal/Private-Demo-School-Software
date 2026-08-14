const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function initExpenseTables() {
    try {
        console.log('Creating expense tables...');
        
        const sql = fs.readFileSync(
            path.join(__dirname, 'create-expenses-tables.sql'),
            'utf8'
        );
        
        await pool.query(sql);
        
        console.log('Expense tables created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error creating expense tables:', err.message);
        process.exit(1);
    }
}

initExpenseTables();
