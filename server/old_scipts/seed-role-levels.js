// Seed script to initialize role levels for existing and new roles
// Run this after migration to ensure all roles have proper levels

const pool = require('./db');

async function seedRoleLevels() {
    const client = await pool.connect();
    try {
        console.log('Seeding role levels...');

        // Define all role levels (system + common custom roles)
        const roleLevels = {
            'Administrator': 100,
            'Principal': 95,
            'Vice Principal': 90,
            'Coordinator': 75,
            'Primary Head': 65,
            'Middle Head': 65,
            'Matric Head': 65,
            'Teacher': 50,
            'Accountant': 30,
            'Assistant': 20,
            'Student': 10
        };

        // Update existing roles with levels
        for (const [roleName, level] of Object.entries(roleLevels)) {
            const res = await client.query(
                'SELECT id FROM app_roles WHERE role_name = $1',
                [roleName]
            );

            if (res.rows.length > 0) {
                await client.query(
                    'UPDATE app_roles SET role_level = $1 WHERE role_name = $2',
                    [level, roleName]
                );
                console.log(`✓ Updated role "${roleName}" → level ${level}`);
            } else {
                // Create missing common roles (system defaults)
                if (['Administrator', 'Teacher', 'Accountant', 'Student'].includes(roleName)) {
                    const isSystem = ['Administrator', 'Teacher', 'Accountant', 'Student'].includes(roleName);
                    await client.query(
                        `INSERT INTO app_roles (role_name, description, role_level, is_system_default, is_custom)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (role_name) DO UPDATE SET role_level = $3`,
                        [roleName, `${roleName} role`, level, isSystem, !isSystem]
                    );
                    console.log(`✓ Created/updated role "${roleName}" → level ${level}`);
                }
            }
        }

        console.log('Role level seeding completed!');
        return { success: true };
    } catch (err) {
        console.error('Error seeding role levels:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Run if executed directly
if (require.main === module) {
    seedRoleLevels()
        .then(() => {
            console.log('Seed complete');
            process.exit(0);
        })
        .catch(err => {
            console.error('Seed failed:', err);
            process.exit(1);
        });
}

module.exports = seedRoleLevels;
