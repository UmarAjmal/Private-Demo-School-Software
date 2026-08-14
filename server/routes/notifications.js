const express = require('express');
const router = express.Router();
const pool = require('../db');
const { createNotification } = require('../utils/notify');

// GET /notifications - Fetch notifications with unread count
router.get('/', async (req, res) => {
    try {
        const { user_id, family_id, student_id, role, limit = 50 } = req.query;

        let conditions = [];
        let params = [];
        let paramIdx = 1;

        if (user_id) {
            conditions.push(`user_id = $${paramIdx++}`);
            params.push(user_id);
        }
        if (family_id && family_id.trim()) {
            conditions.push(`family_id = $${paramIdx++}`);
            params.push(family_id.trim());
        }
        if (student_id) {
            conditions.push(`student_id = $${paramIdx++}`);
            params.push(student_id);
        }
        if (role && role.trim()) {
            const normalizedRole = role.trim().toLowerCase();
            if (['admin', 'principal', 'coordinator', 'vice_principal'].includes(normalizedRole)) {
                conditions.push(`(LOWER(role) IN ('admin', 'principal', 'coordinator', 'vice_principal', 'all') AND family_id IS NULL)`);
            } else {
                conditions.push(`(LOWER(role) = $${paramIdx++} OR (LOWER(role) = 'all' AND family_id IS NULL))`);
                params.push(normalizedRole);
            }
        }

        if (conditions.length === 0) {
            conditions.push(`(LOWER(role) = 'all' AND family_id IS NULL)`);
        }

        const whereClause = `WHERE ${conditions.map(c => `(${c})`).join(' OR ')}`;

        const query = `
            SELECT * FROM notifications 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT $${paramIdx}
        `;
        params.push(parseInt(limit, 10));

        const result = await pool.query(query, params);

        const unreadCountRes = await pool.query(`
            SELECT COUNT(*) AS unread_count 
            FROM notifications 
            ${whereClause} AND is_read = FALSE
        `, params.slice(0, params.length - 1));

        const unreadCount = parseInt(unreadCountRes.rows[0]?.unread_count || '0', 10);

        res.json({
            notifications: result.rows,
            unread_count: unreadCount
        });
    } catch (err) {
        console.error("Error fetching notifications:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /notifications/:id/read - Mark single notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`,
            [id]
        );
        res.json({ notification: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /notifications/mark-all-read - Mark all as read for user/family/role
router.put('/mark-all-read', async (req, res) => {
    try {
        const { user_id, family_id, role } = req.body;

        let conditions = [];
        let params = [];
        let paramIdx = 1;

        if (user_id) {
            conditions.push(`user_id = $${paramIdx++}`);
            params.push(user_id);
        }
        if (family_id && family_id.trim()) {
            conditions.push(`family_id = $${paramIdx++}`);
            params.push(family_id.trim());
        }
        if (role && role.trim()) {
            conditions.push(`LOWER(role) = $${paramIdx++} OR LOWER(role) = 'all'`);
            params.push(role.trim().toLowerCase());
        }

        if (conditions.length === 0) {
            conditions.push(`LOWER(role) = 'all'`);
        }

        const whereClause = `WHERE ${conditions.join(' OR ')}`;

        await pool.query(`UPDATE notifications SET is_read = TRUE ${whereClause}`, params);
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /notifications/:id - Delete single notification
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM notifications WHERE id = $1`, [id]);
        res.json({ message: "Notification deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /notifications/create - Manually create custom announcement
router.post('/create', async (req, res) => {
    try {
        const { userId, familyId, studentId, role, type = 'general', title, message, link } = req.body;
        const notification = await createNotification({
            userId, familyId, studentId, role, type, title, message, link
        });
        res.json({ notification });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
