const router = require('express').Router();
const pool = require('../db');

// List All Roles
router.get('/', async (req, res) => {
    try {
        const roles = await pool.query("SELECT * FROM app_roles ORDER BY id ASC");
        const permissions = await pool.query("SELECT * FROM role_permissions");
        
        const data = roles.rows.map(role => {
            return {
                ...role,
                permissions: permissions.rows.filter(p => p.role_id === role.id)
            };
        });

        res.json(data);
    } catch (err) {
        console.error('Error listing roles:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// Get Single Role (includes assigned count)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const roleRes = await pool.query("SELECT * FROM app_roles WHERE id = $1", [id]);
        if (roleRes.rows.length === 0) return res.status(404).json({ error: 'Role not found', message: 'Role not found' });

        const role = roleRes.rows[0];
        const permissions = await pool.query("SELECT * FROM role_permissions WHERE role_id = $1", [id]);
        const assignedRes = await pool.query("SELECT COUNT(*)::int AS assigned_count FROM app_users WHERE role_id = $1", [id]);

        res.json({
            ...role,
            permissions: permissions.rows,
            assigned_count: assignedRes.rows[0]?.assigned_count || 0
        });
    } catch (err) {
        console.error('Error getting role:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// Get Assigned Count for a Role
router.get('/:id/assigned-count', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT COUNT(*)::int AS assigned_count FROM app_users WHERE role_id = $1", [id]);
        res.json({ assigned_count: result.rows[0]?.assigned_count || 0 });
    } catch (err) {
        console.error('Error getting assigned count:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// Clone Role (create exact copy with permissions)
router.post('/:id/clone', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // STEP 1: Fetch original role
        const originalRes = await client.query("SELECT * FROM app_roles WHERE id = $1", [id]);
        if (originalRes.rows.length === 0) return res.status(404).json({ error: 'Role not found', message: 'Role not found' });

        const original = originalRes.rows[0];

        await client.query('BEGIN');

        // STEP 2: Create new role (copy with " (copy)" suffix)
        const newRoleName = `${original.role_name} (copy)`;
        const newRoleRes = await client.query(
            `INSERT INTO app_roles (role_name, description, role_level, dashboard_access, is_system_default, is_custom)
             VALUES ($1, $2, $3, $4, false, true)
             RETURNING *`,
            [newRoleName, original.description || '', original.role_level || 50, original.dashboard_access || 'admin']
        );
        const newRoleId = newRoleRes.rows[0].id;

        // STEP 3: Copy all permissions from original to new role
        const permsRes = await client.query("SELECT module_name, can_read, can_write, can_delete FROM role_permissions WHERE role_id = $1", [id]);
        
        const seenModules = new Set();
        for (const perm of permsRes.rows) {
            if (!perm.module_name || seenModules.has(perm.module_name)) continue;
            seenModules.add(perm.module_name);
            await client.query(
                `INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete)
                 VALUES ($1, $2, $3, $4, $5)`,
                [newRoleId, perm.module_name, !!perm.can_read, !!perm.can_write, !!perm.can_delete]
            );
        }

        await client.query('COMMIT');

        res.json({
            message: 'Role cloned successfully',
            new_role_id: newRoleId,
            new_role_name: newRoleName,
            new_role: newRoleRes.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error cloning role:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    } finally {
        client.release();
    }
});

// Create New Role
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { role_name, description, role_level, dashboard_access, permissions } = req.body;
        
        if (!role_name || !role_name.trim()) {
            return res.status(400).json({ error: 'Role name is required', message: 'Role name is required' });
        }

        await client.query('BEGIN');

        // 1. Create Role with role_level & dashboard_access
        const newRole = await client.query(
            `INSERT INTO app_roles (role_name, description, role_level, dashboard_access, is_custom)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
            [role_name.trim(), description || '', role_level || 50, dashboard_access || 'admin']
        );
        const roleId = newRole.rows[0].id;

        // 2. Insert Permissions
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            const seenModules = new Set();
            for (const p of permissions) {
                if (!p || !p.module_name || seenModules.has(p.module_name)) continue;
                seenModules.add(p.module_name);
                await client.query(
                    `INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [roleId, p.module_name, !!p.can_read, !!p.can_write, !!p.can_delete]
                );
            }
        }

        await client.query('COMMIT');

        res.json({ ...newRole.rows[0], permissions });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error creating role:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    } finally {
        client.release();
    }
});

// Update Role (with safe editing support & transaction)
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { apply_to_assigned } = req.query;
        const { role_name, description, role_level, dashboard_access, permissions } = req.body;

        // Check if role exists
        const roleCheck = await client.query("SELECT * FROM app_roles WHERE id = $1", [id]);
        if (roleCheck.rows.length === 0) return res.status(404).json({ error: 'Role not found', message: 'Role not found' });

        const currentRole = roleCheck.rows[0];

        // Check assigned count
        const assignedRes = await client.query("SELECT COUNT(*)::int AS count FROM app_users WHERE role_id = $1", [id]);
        const assignedCount = assignedRes.rows[0]?.count || 0;

        // SAFETY CHECK: If role has assigned users and apply_to_assigned is not explicitly true, warn
        if (assignedCount > 0 && apply_to_assigned !== 'true') {
            return res.status(400).json({
                error: 'Role has assigned users',
                message: `This role is assigned to ${assignedCount} user(s). Apply changes to all? Set ?apply_to_assigned=true`,
                assigned_count: assignedCount
            });
        }

        const finalRoleName = (role_name && role_name.trim()) ? role_name.trim() : currentRole.role_name;
        const finalDescription = description !== undefined ? description : (currentRole.description || '');
        const finalRoleLevel = role_level !== undefined ? role_level : (currentRole.role_level || 50);
        const finalDashboardAccess = dashboard_access || currentRole.dashboard_access || 'admin';

        await client.query('BEGIN');

        // 1. Update Role Details
        await client.query(
            `UPDATE app_roles 
             SET role_name = $1, description = $2, role_level = $3, dashboard_access = $4
             WHERE id = $5`,
            [finalRoleName, finalDescription, finalRoleLevel, finalDashboardAccess, id]
        );

        // 2. Update Permissions (Delete all & Re-insert cleanly)
        await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);

        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            const seenModules = new Set();
            for (const p of permissions) {
                if (!p || !p.module_name || seenModules.has(p.module_name)) continue;
                seenModules.add(p.module_name);
                await client.query(
                    `INSERT INTO role_permissions (role_id, module_name, can_read, can_write, can_delete) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [id, p.module_name, !!p.can_read, !!p.can_write, !!p.can_delete]
                );
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Role updated successfully',
            applied_to: assignedCount > 0 ? `${assignedCount} user(s)` : 'no users assigned'
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error updating role:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    } finally {
        client.release();
    }
});

// Delete Role
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if System Default
        const check = await pool.query("SELECT role_name, is_system_default FROM app_roles WHERE id = $1", [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Role not found", message: "Role not found" });
        
        const rName = check.rows[0].role_name;
        if (check.rows[0].is_system_default || ['Administrator', 'Teacher', 'Accountant', 'Student'].includes(rName)) {
            return res.status(403).json({ error: "Forbidden", message: "Cannot delete permanent system roles" });
        }

        await pool.query("DELETE FROM app_roles WHERE id = $1", [id]);
        res.json({ message: "Role deleted successfully" });
    } catch (err) {
        console.error('Error deleting role:', err.message);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

module.exports = router;
