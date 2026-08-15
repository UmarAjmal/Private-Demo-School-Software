const express = require('express');
const router = express.Router();
const pool = require('../db');

async function ensurePromotionTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_academic_records (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
                class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                roll_no VARCHAR(50),
                total_marks NUMERIC(10,2) DEFAULT 0,
                obtained_marks NUMERIC(10,2) DEFAULT 0,
                percentage NUMERIC(5,2) DEFAULT 0,
                grade VARCHAR(10),
                rank_in_class INTEGER,
                status VARCHAR(20) DEFAULT 'active',
                promotion_target_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                promotion_target_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                promoted_to_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                promoted_to_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                promoted_on DATE,
                promoted_at TIMESTAMP,
                promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                attendance_percentage NUMERIC(5,2),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, academic_year_id)
            );

            ALTER TABLE student_academic_records 
            ADD COLUMN IF NOT EXISTS promotion_target_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS promotion_target_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
        `);
    } catch (e) {
        console.error("Error ensuring student_academic_records table:", e.message);
    }
}

// Load students for promotion
router.get('/load-students', async (req, res) => {
    try {
        const { year_id, class_id, section_id } = req.query;

        // Validation
        if (!year_id) {
            return res.status(400).json({ error: 'Academic year is required' });
        }

        // Ensure promotion tables exist in database
        await ensurePromotionTables();

        const yearIdNum = parseInt(year_id.toString(), 10);

        // Build query dynamically based on filters
        let query = `
            SELECT 
                s.student_id as id,
                s.admission_no as admission_number,
                CONCAT(s.first_name, ' ', s.last_name) as student_name,
                s.father_name,
                s.class_id,
                c.class_name,
                s.section_id,
                sec.section_name,
                COALESCE(
                    (SELECT SUM(obtained_marks) 
                     FROM exam_marks em 
                     WHERE em.student_id = s.student_id AND (em.academic_year_id = $1 OR $1 IS NULL)),
                    0
                ) as total_marks,
                COALESCE(
                    (SELECT SUM(total_marks) 
                     FROM exam_marks em 
                     WHERE em.student_id = s.student_id AND (em.academic_year_id = $1 OR $1 IS NULL)),
                    0
                ) as max_marks,
                CASE 
                    WHEN COALESCE(
                        (SELECT SUM(total_marks) 
                         FROM exam_marks em 
                         WHERE em.student_id = s.student_id AND (em.academic_year_id = $1 OR $1 IS NULL)),
                        0
                    ) > 0 
                    THEN ROUND(
                        (COALESCE(
                            (SELECT SUM(obtained_marks) 
                             FROM exam_marks em 
                             WHERE em.student_id = s.student_id AND (em.academic_year_id = $1 OR $1 IS NULL)),
                            0
                        ) * 100.0 / COALESCE(
                            (SELECT SUM(total_marks) 
                             FROM exam_marks em 
                             WHERE em.student_id = s.student_id AND (em.academic_year_id = $1 OR $1 IS NULL)),
                            0
                        )),
                        2
                    )
                    ELSE 0
                END as percentage,
                -- Check if already has record for this year
                CASE 
                    WHEN EXISTS(
                        SELECT 1 FROM student_academic_records 
                        WHERE student_id = s.student_id AND academic_year_id = $1
                    ) THEN true
                    ELSE false
                END as has_record
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            WHERE LOWER(TRIM(s.status)) = 'active'
        `;

        const params = [yearIdNum];
        let paramIndex = 2;

        if (class_id && class_id !== '') {
            query += ` AND s.class_id = $${paramIndex}`;
            params.push(parseInt(class_id.toString(), 10));
            paramIndex++;
        }

        if (section_id && section_id !== '') {
            query += ` AND s.section_id = $${paramIndex}`;
            params.push(parseInt(section_id.toString(), 10));
            paramIndex++;
        }

        query += ` ORDER BY s.first_name, s.last_name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Error in GET /promotion/load-students:", err);
        res.status(500).json({ error: err.message || 'Server Error' });
    }
});

// Execute promotion
router.post('/execute', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { 
            students,          // Array of {student_id, target_class_id, target_section_id, status}
            from_year_id,      // Current academic year
            to_year_id,        // Target academic year
            promoted_by        // User ID who is promoting
        } = req.body;

        // Validation
        if (!students || students.length === 0) {
            return res.status(400).json({ error: 'No students selected for promotion' });
        }

        if (!from_year_id || !to_year_id) {
            return res.status(400).json({ error: 'From year and to year are required' });
        }

        if (!promoted_by) {
            return res.status(400).json({ error: 'User authentication required' });
        }

        // Verify target year is configured
        const yearCheck = await client.query(
            `SELECT id, status, is_configured FROM academic_years 
             WHERE id = $1 AND (
                 (status = 'upcoming' AND is_configured = true) OR 
                 status = 'active'
             )`,
            [to_year_id]
        );

        if (yearCheck.rows.length === 0) {
            return res.status(400).json({ 
                error: 'Target year must be configured before promotion' 
            });
        }

        await client.query('BEGIN');

        let successCount = 0;
        let failedStudents = [];

        for (const student of students) {
            try {
                const { student_id, target_class_id, target_section_id, status } = student;

                // Get student current data and marks
                const studentData = await client.query(
                    `SELECT 
                        s.student_id as id, s.class_id, s.section_id,
                        COALESCE(SUM(em.obtained_marks), 0) as total_obtained,
                        COALESCE(SUM(em.total_marks), 0) as total_max,
                        CASE 
                            WHEN COALESCE(SUM(em.total_marks), 0) > 0 
                            THEN ROUND((COALESCE(SUM(em.obtained_marks), 0) * 100.0 / COALESCE(SUM(em.total_marks), 0)), 2)
                            ELSE 0
                        END as percentage
                     FROM students s
                     LEFT JOIN exam_marks em ON s.student_id = em.student_id AND em.academic_year_id = $1
                     WHERE s.student_id = $2
                     GROUP BY s.student_id, s.class_id, s.section_id`,
                    [from_year_id, student_id]
                );

                if (studentData.rows.length === 0) {
                    failedStudents.push({ student_id, error: 'Student not found' });
                    continue;
                }

                const data = studentData.rows[0];

                // Calculate grade based on percentage
                let grade = 'F';
                if (data.percentage >= 80) grade = 'A+';
                else if (data.percentage >= 70) grade = 'A';
                else if (data.percentage >= 60) grade = 'B';
                else if (data.percentage >= 50) grade = 'C';
                else if (data.percentage >= 40) grade = 'D';

                // Insert/Update record in student_academic_records
                await client.query(
                    `INSERT INTO student_academic_records (
                        student_id, academic_year_id, class_id, section_id,
                        total_marks, obtained_marks, percentage, grade,
                        status, promotion_target_year_id, promotion_target_class_id,
                        promoted_at, promoted_by_user_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
                    ON CONFLICT (student_id, academic_year_id) 
                    DO UPDATE SET
                        class_id = $3,
                        section_id = $4,
                        total_marks = $5,
                        obtained_marks = $6,
                        percentage = $7,
                        grade = $8,
                        status = $9,
                        promotion_target_year_id = $10,
                        promotion_target_class_id = $11,
                        promoted_at = NOW(),
                        promoted_by_user_id = $12,
                        updated_at = NOW()`,
                    [
                        student_id, from_year_id, data.class_id, data.section_id,
                        data.total_max, data.total_obtained, data.percentage, grade,
                        status, to_year_id, target_class_id,
                        promoted_by
                    ]
                );

                // If promoted, update students table with new class
                if (status === 'promoted') {
                    await client.query(
                        `UPDATE students 
                         SET class_id = $1, section_id = $2 
                         WHERE student_id = $3`,
                        [target_class_id, target_section_id, student_id]
                    );
                } else if (status === 'left' || status === 'transferred') {
                    // Mark student as inactive
                    await client.query(
                        `UPDATE students SET status = 'inactive' WHERE student_id = $1`,
                        [student_id]
                    );
                }

                successCount++;
            } catch (studentErr) {
                console.error(`Error promoting student ${student.student_id}:`, studentErr);
                failedStudents.push({ 
                    student_id: student.student_id, 
                    error: studentErr.message 
                });
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Promotion completed: ${successCount} students processed`,
            successCount,
            failedCount: failedStudents.length,
            failedStudents
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Promotion error:', err.message);
        res.status(500).json({ error: 'Promotion failed: ' + err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
