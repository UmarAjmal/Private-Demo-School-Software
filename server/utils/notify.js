const pool = require('../db');

/**
 * Creates and persists a new notification in the database.
 * 
 * @param {Object} payload
 * @param {number|null} payload.userId - Specific user ID
 * @param {string|null} payload.familyId - Specific family ID (notifies entire family unit/siblings)
 * @param {number|null} payload.studentId - Specific student ID
 * @param {string|null} payload.role - Role targeted (e.g., 'admin', 'principal', 'vice_principal', 'coordinator', 'teacher', 'staff', 'student', 'all')
 * @param {string} payload.type - Notification type ('fee_payment', 'attendance', 'exam_approval', 'test_marks', 'staff_attendance', 'general')
 * @param {string} payload.title - Short notification title
 * @param {string} payload.message - Notification message content
 * @param {string|null} payload.link - Optional target route link when clicked
 */
async function createNotification({
    userId = null,
    familyId = null,
    studentId = null,
    role = null,
    type = 'general',
    title,
    message,
    link = null,
    clientOrPool = pool
}) {
    try {
        if (!title || !message) {
            console.error("⚠️ createNotification missing required title or message");
            return null;
        }

        const normalizedFamilyId = familyId ? familyId.trim() : null;

        const res = await clientOrPool.query(
            `INSERT INTO notifications 
                (user_id, family_id, student_id, role, type, title, message, link, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())
             RETURNING *`,
            [userId, normalizedFamilyId, studentId, role, type, title, message, link]
        );

        console.log(`🔔 Notification created [${type}]: ${title} -> (Family: ${normalizedFamilyId || 'N/A'}, Role: ${role || 'N/A'}, User: ${userId || 'N/A'})`);
        return res.rows[0];
    } catch (err) {
        console.error("❌ Error creating notification:", err.message);
        return null;
    }
}

module.exports = { createNotification };
