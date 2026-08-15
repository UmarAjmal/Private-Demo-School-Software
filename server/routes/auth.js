const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shaheen_school_jwt_secret_key_2026_secure';

// Helper to fetch security policies from system_settings
async function getSecurityPolicies() {
    try {
        const res = await pool.query(`
            SELECT setting_key, setting_value 
            FROM system_settings 
            WHERE category = 'security' OR setting_key IN ('max_login_attempts', 'password_min_length', 'session_timeout_minutes')
        `);
        const policies = {
            max_login_attempts: 5,
            password_min_length: 6,
            session_timeout_minutes: 1440 // default 24h
        };
        res.rows.forEach(r => {
            if (r.setting_key === 'max_login_attempts') policies.max_login_attempts = parseInt(r.setting_value, 10) || 5;
            if (r.setting_key === 'password_min_length') policies.password_min_length = parseInt(r.setting_value, 10) || 6;
            if (r.setting_key === 'session_timeout_minutes') policies.session_timeout_minutes = parseInt(r.setting_value, 10) || 1440;
        });
        return policies;
    } catch (e) {
        return { max_login_attempts: 5, password_min_length: 6, session_timeout_minutes: 1440 };
    }
}

// GET /auth/security-policies
router.get('/security-policies', async (req, res) => {
    const policies = await getSecurityPolicies();
    res.json(policies);
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password, remember_me } = req.body;

        if (!username || !password || !username.trim()) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const cleanUsername = username.trim();
        const policies = await getSecurityPolicies();

        // 1. Fetch user with role info, permissions, lock status & incharge info
        let result;
        try {
            result = await pool.query(`
                SELECT 
                    u.id, u.username, u.password_hash, u.full_name, u.email, u.is_active, u.role_id,
                    COALESCE(u.failed_login_attempts, 0) AS failed_login_attempts,
                    u.locked_until,
                    r.role_name, r.role_level, r.dashboard_access,
                    MAX(e.employee_id) as employee_id,
                    MAX(
                        (SELECT json_build_object('class_id', tca.class_id, 'section_id', tca.section_id)
                         FROM teacher_class_assignment tca
                         WHERE tca.employee_id = e.employee_id AND tca.is_class_teacher = true
                         LIMIT 1)::text
                    ) AS incharge_class,
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
                LEFT JOIN employees e ON u.id = e.app_user_id
                WHERE LOWER(u.username) = LOWER($1)
                GROUP BY u.id, u.username, u.password_hash, u.full_name, u.email, u.is_active, u.role_id, u.failed_login_attempts, u.locked_until, r.role_name, r.role_level, r.dashboard_access
            `, [cleanUsername]);
        } catch (e) {
            // Fallback query if complex join/subquery fails
            result = await pool.query(`
                SELECT 
                    u.id, u.username, u.password_hash, u.full_name, u.email, u.is_active, u.role_id,
                    0 AS failed_login_attempts, NULL AS locked_until,
                    r.role_name, r.role_level, r.dashboard_access,
                    NULL as employee_id, NULL as incharge_class, '[]'::json AS permissions
                FROM app_users u
                LEFT JOIN app_roles r ON u.role_id = r.id
                WHERE LOWER(u.username) = LOWER($1)
            `, [cleanUsername]);
        }

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = result.rows[0];

        // 2. Check if account is active
        if (user.is_active === false) {
            return res.status(403).json({ message: 'Your account is disabled. Please contact the administrator.' });
        }

        // 3. Check Account Lockout Policy
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.status(423).json({
                message: `Account is locked due to multiple failed login attempts. Please try again in ${minutesLeft} minute(s).`
            });
        }

        // 4. Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash || '');
        if (!isMatch) {
            const newFailedCount = (user.failed_login_attempts || 0) + 1;
            let lockMsg = '';

            try {
                if (newFailedCount >= policies.max_login_attempts) {
                    const lockTime = new Date(Date.now() + 15 * 60 * 1000);
                    await pool.query(
                        `UPDATE app_users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
                        [newFailedCount, lockTime, user.id]
                    );
                    lockMsg = ` Account locked for 15 minutes due to ${policies.max_login_attempts} failed attempts.`;
                } else {
                    await pool.query(
                        `UPDATE app_users SET failed_login_attempts = $1 WHERE id = $2`,
                        [newFailedCount, user.id]
                    );
                    const remaining = policies.max_login_attempts - newFailedCount;
                    lockMsg = ` ${remaining} attempt(s) remaining before account lockout.`;
                }
            } catch (e) {}

            return res.status(401).json({ message: `Invalid username or password.${lockMsg}` });
        }

        // 5. Successful password verify -> Reset failed login counter
        try {
            await pool.query(
                `UPDATE app_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
                [user.id]
            );
        } catch (e) {}

        // 6. Sign JWT Token
        const tokenDurationHours = remember_me ? 24 : 12;
        const expiresAt = new Date(Date.now() + tokenDurationHours * 60 * 60 * 1000);

        const tokenPayload = {
            id: user.id,
            username: user.username,
            role_id: user.role_id,
            role_name: user.role_name
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: `${tokenDurationHours}h` });

        // 7. Track Active Session in DB (Safe Execution)
        try {
            const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
            const user_agent = req.headers['user-agent'] || 'Unknown Browser';

            await pool.query(`
                INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, remember_me, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [user.id, token, ip_address, user_agent, !!remember_me, expiresAt]);
        } catch (e) {
            console.warn('Session tracking notice:', e.message);
        }

        // 8. Format & Return Safe User Payload
        const { password_hash, failed_login_attempts, locked_until, ...safeUser } = user;
        if (safeUser.incharge_class && typeof safeUser.incharge_class === 'string') {
            try {
                safeUser.incharge_class = JSON.parse(safeUser.incharge_class);
            } catch (e) {}
        }

        // Auto-detect Student / Family user account
        const rNameLower = (safeUser.role_name || '').toLowerCase();
        const uNameUpper = (safeUser.username || '').toUpperCase();
        let isStudentUser = rNameLower.includes('student') || rNameLower.includes('family') || uNameUpper.startsWith('STU-') || uNameUpper.startsWith('FAM-');
        
        if (!isStudentUser && safeUser.id) {
            try {
                const sCheck = await pool.query('SELECT student_id FROM students WHERE user_id = $1 LIMIT 1', [safeUser.id]);
                if (sCheck.rows.length > 0) {
                    isStudentUser = true;
                    safeUser.student_id = sCheck.rows[0].student_id;
                }
            } catch (e) {}
        }

        if (isStudentUser) {
            safeUser.dashboard_access = 'student';
            if (!safeUser.role_name || safeUser.role_name === 'Administrator') {
                safeUser.role_name = 'Student';
            }
            safeUser.role_level = 10;
        }

        res.json({
            ...safeUser,
            token,
            remember_me: !!remember_me,
            expires_at: expiresAt.toISOString()
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error', message: err?.message || 'Server error during authentication' });
    }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE session_token = $1`, [token]);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        res.json({ success: true });
    }
});

// GET /auth/active-sessions
router.get('/active-sessions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.session_id,
                s.user_id,
                u.username,
                u.full_name,
                r.role_name,
                s.ip_address,
                s.user_agent,
                s.remember_me,
                s.created_at,
                s.last_activity,
                s.expires_at,
                s.is_revoked
            FROM user_sessions s
            JOIN app_users u ON s.user_id = u.id
            LEFT JOIN app_roles r ON u.role_id = r.id
            WHERE s.is_revoked = FALSE AND s.expires_at > CURRENT_TIMESTAMP
            ORDER BY s.last_activity DESC
            LIMIT 50
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch active sessions:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /auth/revoke-session
router.post('/revoke-session', async (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) return res.status(400).json({ error: 'session_id is required' });

        await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE session_id = $1`, [session_id]);
        res.json({ success: true, message: 'Session terminated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /auth/revoke-all-sessions
router.post('/revoke-all-sessions', async (req, res) => {
    try {
        const { user_id } = req.body;
        if (user_id) {
            await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [user_id]);
        } else {
            await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE is_revoked = FALSE`);
        }
        res.json({ success: true, message: 'All active sessions terminated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
