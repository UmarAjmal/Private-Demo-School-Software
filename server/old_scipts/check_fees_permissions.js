const pool = require('./db');

async function checkPermissions() {
    try {
        // Check all fee and exam related permissions
        const result = await pool.query(`
            SELECT DISTINCT module_name 
            FROM role_permissions 
            WHERE module_name LIKE '%fee%' 
               OR module_name LIKE '%exam%'
            ORDER BY module_name
        `);
        
        console.log('Fee & Exam Related Permissions:');
        result.rows.forEach(row => console.log('  -', row.module_name));
        
        // Check what roles have access to these
        console.log('\n\nRole Permissions Details:');
        const rolePerms = await pool.query(`
            SELECT r.role_name, p.module_name, p.can_read, p.can_write, p.can_delete
            FROM role_permissions p
            JOIN app_roles r ON r.id = p.role_id
            WHERE p.module_name LIKE '%fee%' 
               OR p.module_name LIKE '%exam%'
            ORDER BY r.role_name, p.module_name
        `);
        
        rolePerms.rows.forEach(row => {
            console.log(`  ${row.role_name}: ${row.module_name} (R:${row.can_read} W:${row.can_write} D:${row.can_delete})`);
        });
        
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit();
}

checkPermissions();
