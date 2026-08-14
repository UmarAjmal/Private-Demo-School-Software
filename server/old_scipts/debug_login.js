const pool = require('./db');

// Test what login response looks like
async function testLogin() {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.username, u.password_hash, u.full_name, u.email, u.is_active, u.role_id,
                r.role_name, r.role_level,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'module_name', p.module_name,
                            'can_read', p.can_read,
                            'can_write', p.can_write,
                            'can_delete', p.can_delete
                        )
                    ) FILTER (WHERE p.module_name IS NOT NULL),
                    '[]'
                ) AS permissions
            FROM app_users u
            LEFT JOIN app_roles r ON u.role_id = r.id
            LEFT JOIN role_permissions p ON r.id = p.role_id
            WHERE u.username = $1
            GROUP BY u.id, u.username, u.password_hash, u.full_name, u.email, u.is_active, u.role_id, r.role_name, r.role_level
        `, ['admin']);

        console.log('Login response structure:');
        console.log(JSON.stringify(result.rows[0], null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit();
}

testLogin();
