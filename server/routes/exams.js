const router = require('express').Router();
const pool = require('../db');

let ensureTablesPromise = null;

async function ensureTables() {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS exam_marks (
                    mark_id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
                    academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    total_marks NUMERIC(10,2) NOT NULL CHECK (total_marks > 0),
                    obtained_marks NUMERIC(10,2) NOT NULL CHECK (obtained_marks >= 0),
                    entered_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    entered_by_employee_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, subject_id, term_id),
                    CHECK (obtained_marks <= total_marks)
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS exam_mark_locks (
                    lock_id SERIAL PRIMARY KEY,
                    term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    locked_by_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(term_id, class_id, section_id, subject_id, locked_by_user_id)
                );
            `);

            await pool.query(`CREATE INDEX IF NOT EXISTS idx_exam_marks_term_subject ON exam_marks(term_id, subject_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_exam_marks_class_section ON exam_marks(class_id, section_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_exam_locks_combo_user ON exam_mark_locks(term_id, class_id, section_id, subject_id, locked_by_user_id);`);
        })();
    }
    return ensureTablesPromise;
}

function parseUserId(input) {
    const value = Number(input);
    return Number.isInteger(value) && value > 0 ? value : null;
}

async function getUserContext(client, userId) {
    const userRes = await client.query(
        `SELECT u.id, u.is_active, r.role_name, r.role_level
         FROM app_users u
         LEFT JOIN app_roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [userId]
    );

    if (userRes.rows.length === 0) {
        return { error: { status: 404, message: 'User not found' } };
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
        return { error: { status: 403, message: 'User is inactive' } };
    }

    // Role hierarchy: Admin(90+) can do anything, Supervisor(65+) can supervise/manage teachers
    const isAdmin = (user.role_level || 0) >= 90;
    const isSupervisor = (user.role_level || 0) >= 65;

    const empRes = await client.query(
        `SELECT employee_id
         FROM employees
         WHERE app_user_id = $1
         ORDER BY employee_id ASC
         LIMIT 1`,
        [userId]
    );

    return {
        user,
        isAdmin,
        isSupervisor,
        employeeId: empRes.rows[0]?.employee_id || null
    };
}

async function getActiveAcademicYear(client) {
    let yearRes = await client.query(
        `SELECT id, year_name, is_active
         FROM academic_years
         WHERE is_active = TRUE
         ORDER BY id DESC
         LIMIT 1`
    );

    if (yearRes.rows.length === 0) {
        yearRes = await client.query(
            `SELECT id, year_name, is_active
             FROM academic_years
             ORDER BY id DESC
             LIMIT 1`
        );
    }

    return yearRes.rows[0] || null;
}

async function canTeacherAccessSheet(client, employeeId, classId, sectionId, subjectId) {
    if (!employeeId) return false;

    // Check class assignment
    let accessRes = await client.query(
        `SELECT 1
         FROM teacher_class_assignment tca
         WHERE tca.employee_id = $1
           AND tca.class_id = $2
           AND tca.section_id = $3
           AND tca.is_class_teacher = true
         LIMIT 1`,
        [employeeId, classId, sectionId]
    );

    if (accessRes.rows.length > 0) return true;

    // Check optional subject assignment
    if (subjectId) {
        accessRes = await client.query(
            `SELECT 1
             FROM teacher_subject_assignment tsa
             WHERE tsa.employee_id = $1
               AND tsa.subject_id = $2
             LIMIT 1`,
            [employeeId, subjectId]
        );
        if (accessRes.rows.length > 0) return true;
    }

    return false;
}

async function canTeacherAccessClassSection(client, employeeId, classId, sectionId) {
    if (!employeeId) return false;

    // Check class assignment
    let accessRes = await client.query(
        `SELECT 1
         FROM teacher_class_assignment
         WHERE employee_id = $1
           AND class_id = $2
           AND section_id = $3
           AND is_class_teacher = true
         LIMIT 1`,
        [employeeId, classId, sectionId]
    );

    return accessRes.rows.length > 0;
}

function ordinalSuffix(n) {
    if (!Number.isInteger(n) || n < 1) return null;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getGrade(percentage) {
    if (percentage === null || percentage === undefined || isNaN(percentage)) return null;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

// Returns Map<student_id, {position, ordinal_position, percentage, grade}>
// Only students with marked_count > 0 get a position.
// Uses standard competition ranking: tied scores share same rank, next rank skips.
function computeClassRanks(rows) {
    const eligible = rows
        .filter(r => Number(r.marked_count) > 0)
        .sort((a, b) => Number(b.obtained_total) - Number(a.obtained_total));

    const rankMap = new Map();
    let rank = 0;
    let prevScore = null;
    let count = 0;

    for (const row of eligible) {
        count++;
        const score = Number(row.obtained_total);
        if (prevScore === null || score < prevScore) {
            rank = count;
            prevScore = score;
        }
        const totalTotal = Number(row.total_total);
        const percentage = totalTotal > 0
            ? Math.round((score / totalTotal) * 1000) / 10
            : null;
        rankMap.set(row.student_id, {
            position: rank,
            ordinal_position: ordinalSuffix(rank),
            percentage,
            grade: getGrade(percentage)
        });
    }

    // Students with no marks get null rank
    for (const row of rows) {
        if (Number(row.marked_count) === 0) {
            rankMap.set(row.student_id, {
                position: null,
                ordinal_position: null,
                percentage: null,
                grade: null
            });
        }
    }

    return rankMap;
}

router.get('/context', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.query.user_id);
        if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        const activeYear = await getActiveAcademicYear(client);
        if (!activeYear) {
            return res.status(404).json({ error: 'No academic year found. Please create/activate one first.' });
        }

        const termRes = await client.query(
            `SELECT id, term_name, start_date, end_date
             FROM academic_terms
             WHERE academic_year_id = $1
             ORDER BY id ASC`,
            [activeYear.id]
        );

        let classes = [];
        let sections = [];
        let subjects = [];

        // Admin (>=90) and Supervisor (>=65) can see all classes
        if (ctx.isAdmin || ctx.isSupervisor) {
            const classRes = await client.query(`SELECT class_id, class_name FROM classes ORDER BY class_name ASC`);
            const sectionRes = await client.query(`SELECT section_id, section_name, class_id FROM sections ORDER BY class_id, section_name ASC`);
            const subjectRes = await client.query(
                `SELECT s.subject_id, s.subject_name, s.subject_code,
                        sec.section_id, sec.section_name,
                        c.class_id, c.class_name
                 FROM subjects s
                 JOIN sections sec ON sec.section_id = s.section_id
                 JOIN classes c ON c.class_id = sec.class_id
                 ORDER BY c.class_name, sec.section_name, s.subject_name`
            );

            classes = classRes.rows;
            sections = sectionRes.rows;
            subjects = subjectRes.rows;
        } else {
            // Teacher: See only assigned classes
            if (!ctx.employeeId) {
                return res.json({
                    is_admin: false,
                    active_year: activeYear,
                    terms: termRes.rows,
                    classes: [],
                    sections: [],
                    subjects: []
                });
            }

            const scopeRes = await client.query(
                `SELECT DISTINCT
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name,
                    s.subject_id, s.subject_name, s.subject_code
                 FROM teacher_subject_assignment tsa
                 JOIN subjects s ON s.subject_id = tsa.subject_id
                 JOIN sections sec ON sec.section_id = s.section_id
                 JOIN classes c ON c.class_id = sec.class_id
                 WHERE tsa.employee_id = $1

                 UNION

                 SELECT DISTINCT
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name,
                    NULL::int as subject_id, NULL::varchar as subject_name, NULL::varchar as subject_code
                 FROM teacher_class_assignment tca
                 JOIN classes c ON c.class_id = tca.class_id
                 JOIN sections sec ON sec.section_id = tca.section_id
                 WHERE tca.employee_id = $1 AND tca.is_class_teacher = true

                 ORDER BY class_name, section_name, subject_name`,
                [ctx.employeeId]
            );

            const classMap = new Map();
            const sectionMap = new Map();

            for (const row of scopeRes.rows) {
                classMap.set(row.class_id, { class_id: row.class_id, class_name: row.class_name });
                sectionMap.set(row.section_id, {
                    section_id: row.section_id,
                    section_name: row.section_name,
                    class_id: row.class_id
                });
            }

            classes = Array.from(classMap.values());
            sections = Array.from(sectionMap.values());
            subjects = scopeRes.rows
                .filter(r => r.subject_id !== null && r.subject_id !== undefined)
                .map(r => ({
                    subject_id: r.subject_id,
                    subject_name: r.subject_name,
                    subject_code: r.subject_code,
                    section_id: r.section_id,
                    section_name: r.section_name,
                    class_id: r.class_id,
                    class_name: r.class_name
                }));
        }

        res.json({
            is_admin: ctx.isAdmin,
            active_year: activeYear,
            terms: termRes.rows,
            classes,
            sections,
            subjects
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/context/class-teacher', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = parseUserId(req.query.user_id);
        if (!userId) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        const activeYear = await getActiveAcademicYear(client);
        if (!activeYear) {
            return res.status(404).json({ error: 'No academic year found. Please create/activate one first.' });
        }

        const termRes = await client.query(
            `SELECT id, term_name, start_date, end_date
             FROM academic_terms
             WHERE academic_year_id = $1
             ORDER BY id ASC`,
            [activeYear.id]
        );

        let classes = [];
        let sections = [];

        if (ctx.isAdmin || ctx.isSupervisor) {
            const classRes = await client.query(`SELECT class_id, class_name FROM classes ORDER BY class_name ASC`);
            const sectionRes = await client.query(`SELECT section_id, section_name, class_id FROM sections ORDER BY class_id, section_name ASC`);
            classes = classRes.rows;
            sections = sectionRes.rows;
        } else {
            if (!ctx.employeeId) {
                return res.json({
                    is_admin: false,
                    active_year: activeYear,
                    terms: termRes.rows,
                    classes: [],
                    sections: []
                });
            }

            const scopeRes = await client.query(
                `SELECT DISTINCT
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name
                 FROM teacher_class_assignment tca
                 JOIN classes c ON c.class_id = tca.class_id
                 JOIN sections sec ON sec.section_id = tca.section_id
                 WHERE tca.employee_id = $1 AND tca.is_class_teacher = true
                 ORDER BY class_name, section_name`,
                [ctx.employeeId]
            );

            const classMap = new Map();
            const sectionMap = new Map();

            for (const row of scopeRes.rows) {
                classMap.set(row.class_id, { class_id: row.class_id, class_name: row.class_name });
                sectionMap.set(row.section_id, {
                    section_id: row.section_id,
                    section_name: row.section_name,
                    class_id: row.class_id
                });
            }

            classes = Array.from(classMap.values());
            sections = Array.from(sectionMap.values());
        }

        res.json({
            is_admin: ctx.isAdmin,
            active_year: activeYear,
            terms: termRes.rows,
            classes,
            sections
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/marking-sheet', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.query.user_id);
        const termId = Number(req.query.term_id);
        const classId = Number(req.query.class_id);
        const sectionId = Number(req.query.section_id);
        const subjectId = Number(req.query.subject_id);

        if (!userId || !termId || !classId || !sectionId || !subjectId) {
            return res.status(400).json({ error: 'user_id, term_id, class_id, section_id, subject_id are required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessSheet(client, ctx.employeeId, classId, sectionId, subjectId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });
        }

        const metaRes = await client.query(
            `SELECT t.id AS term_id, t.term_name,
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name,
                    s.subject_id, s.subject_name, s.subject_code
             FROM academic_terms t
             JOIN classes c ON c.class_id = $2
             JOIN sections sec ON sec.section_id = $3
             JOIN subjects s ON s.subject_id = $4 AND s.section_id = sec.section_id
             WHERE t.id = $1`,
            [termId, classId, sectionId, subjectId]
        );

        if (metaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid term/class/section/subject combination' });
        }

        const studentsRes = await client.query(
            `SELECT s.student_id, s.first_name, s.last_name, s.admission_no, s.roll_no,
                    em.mark_id, em.total_marks, em.obtained_marks, em.updated_at
             FROM students s
             LEFT JOIN exam_marks em
               ON em.student_id = s.student_id
              AND em.term_id = $1
              AND em.subject_id = $2
             WHERE s.class_id = $3
               AND s.section_id = $4
               AND s.status = 'Active'
             ORDER BY s.roll_no ASC NULLS LAST, s.first_name ASC, s.last_name ASC`,
            [termId, subjectId, classId, sectionId]
        );

        const lockRes = await client.query(
            `SELECT lock_id, locked_at
             FROM exam_mark_locks
             WHERE term_id = $1
               AND class_id = $2
               AND section_id = $3
               AND subject_id = $4
               AND locked_by_user_id = $5
             LIMIT 1`,
            [termId, classId, sectionId, subjectId, userId]
        );

        const readonly = !ctx.isAdmin && lockRes.rows.length > 0;
        const hasAnyMarks = studentsRes.rows.some(r => r.mark_id !== null);
        const totalMarks = studentsRes.rows.find(r => r.total_marks !== null)?.total_marks || null;

        res.json({
            meta: metaRes.rows[0],
            readonly,
            lock: lockRes.rows[0] || null,
            has_any_marks: hasAnyMarks,
            total_marks: totalMarks,
            students: studentsRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post('/marks/save', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.body.user_id);
        const termId = Number(req.body.term_id);
        const classId = Number(req.body.class_id);
        const sectionId = Number(req.body.section_id);
        const subjectId = Number(req.body.subject_id);
        const totalMarks = Number(req.body.total_marks);
        const marks = Array.isArray(req.body.marks) ? req.body.marks : [];

        if (!userId || !termId || !classId || !sectionId || !subjectId) {
            return res.status(400).json({ error: 'user_id, term_id, class_id, section_id, subject_id are required' });
        }
        if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
            return res.status(400).json({ error: 'total_marks must be greater than 0' });
        }
        if (marks.length === 0) {
            return res.status(400).json({ error: 'marks array is required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessSheet(client, ctx.employeeId, classId, sectionId, subjectId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });

            const lockCheck = await client.query(
                `SELECT lock_id
                 FROM exam_mark_locks
                 WHERE term_id = $1
                   AND class_id = $2
                   AND section_id = $3
                   AND subject_id = $4
                   AND locked_by_user_id = $5
                 LIMIT 1`,
                [termId, classId, sectionId, subjectId, userId]
            );
            if (lockCheck.rows.length > 0) {
                return res.status(403).json({ error: 'This sheet is locked. You can only view it now.' });
            }
        }

        const termRes = await client.query(`SELECT id, academic_year_id FROM academic_terms WHERE id = $1`, [termId]);
        if (termRes.rows.length === 0) {
            return res.status(404).json({ error: 'Term not found' });
        }

        const academicYearId = termRes.rows[0].academic_year_id;

        const studentIds = [...new Set(marks.map(m => Number(m.student_id)).filter(v => Number.isInteger(v) && v > 0))];
        if (studentIds.length !== marks.length) {
            return res.status(400).json({ error: 'Each mark row must have a unique valid student_id' });
        }

        const validStudentsRes = await client.query(
            `SELECT student_id
             FROM students
             WHERE class_id = $1
               AND section_id = $2
               AND status = 'Active'
               AND student_id = ANY($3::int[])`,
            [classId, sectionId, studentIds]
        );

        const validSet = new Set(validStudentsRes.rows.map(r => r.student_id));
        for (const studentId of studentIds) {
            if (!validSet.has(studentId)) {
                return res.status(400).json({ error: `Student ${studentId} does not belong to selected class/section or is not active` });
            }
        }

        for (const row of marks) {
            const obtained = Number(row.obtained_marks);
            if (!Number.isFinite(obtained) || obtained < 0 || obtained > totalMarks) {
                return res.status(400).json({ error: `Invalid obtained_marks for student ${row.student_id}` });
            }
        }

        await client.query('BEGIN');

        for (const row of marks) {
            const studentId = Number(row.student_id);
            const obtained = Number(row.obtained_marks);
            await client.query(
                `INSERT INTO exam_marks (
                    student_id, subject_id, term_id, academic_year_id,
                    class_id, section_id, total_marks, obtained_marks,
                    entered_by_user_id, entered_by_employee_id, updated_at
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
                 ON CONFLICT (student_id, subject_id, term_id)
                 DO UPDATE SET
                    academic_year_id = EXCLUDED.academic_year_id,
                    class_id = EXCLUDED.class_id,
                    section_id = EXCLUDED.section_id,
                    total_marks = EXCLUDED.total_marks,
                    obtained_marks = EXCLUDED.obtained_marks,
                    entered_by_user_id = EXCLUDED.entered_by_user_id,
                    entered_by_employee_id = EXCLUDED.entered_by_employee_id,
                    updated_at = NOW()`,
                [
                    studentId, subjectId, termId, academicYearId,
                    classId, sectionId, totalMarks, obtained,
                    userId, ctx.employeeId
                ]
            );
        }

        let locked = false;
        if (!ctx.isAdmin) {
            await client.query(
                `INSERT INTO exam_mark_locks (term_id, class_id, section_id, subject_id, locked_by_user_id)
                 VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (term_id, class_id, section_id, subject_id, locked_by_user_id)
                 DO NOTHING`,
                [termId, classId, sectionId, subjectId, userId]
            );
            locked = true;
        }

        await client.query('COMMIT');

        // Dispatch Exam Approval & Published Result Notifications
        try {
            const { createNotification } = require('../utils/notify');
            const classInfo = await pool.query(`SELECT class_name FROM classes WHERE class_id = $1`, [classId]);
            const subInfo = await pool.query(`SELECT subject_name FROM subjects WHERE subject_id = $1`, [subjectId]);
            const className = classInfo.rows[0]?.class_name || `Class #${classId}`;
            const subName = subInfo.rows[0]?.subject_name || `Subject #${subjectId}`;

            // 1. Notify Higher Roles (Admin, Principal, Vice Principal, Coordinator)
            const rolesToNotify = ['admin', 'principal', 'vice_principal', 'coordinator'];
            for (const rName of rolesToNotify) {
                await createNotification({
                    role: rName,
                    type: 'exam_approval',
                    title: 'Exam Marks Submitted for Approval 📝',
                    message: `Exam/Test marks for ${className} (${subName}) have been recorded & locked by staff. Click to review and approve.`,
                    link: '/examination/marks'
                });
            }

            // 2. Notify Families of students
            for (const row of marks) {
                const sId = Number(row.student_id);
                const sInfo = await pool.query(
                    `SELECT CONCAT(first_name, ' ', last_name) AS full_name, family_id FROM students WHERE student_id = $1`,
                    [sId]
                );
                if (sInfo.rows[0]) {
                    await createNotification({
                        familyId: sInfo.rows[0].family_id,
                        studentId: sId,
                        type: 'test_marks',
                        title: 'New Exam / Test Marks Entered 📊',
                        message: `New marks recorded for ${sInfo.rows[0].full_name} in ${className} (${subName}): ${row.obtained_marks}/${totalMarks}.`,
                        link: `/students/profile/${sId}`
                    });
                }
            }
        } catch (notifErr) {
            console.error("Exam notification error:", notifErr.message);
        }

        res.json({
            message: ctx.isAdmin
                ? 'Marks saved successfully.'
                : 'Marks saved and locked successfully. You can only view them now.',
            locked
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.get('/result-card/students', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.query.user_id);
        const termId = Number(req.query.term_id);
        const classId = Number(req.query.class_id);
        const sectionId = Number(req.query.section_id);

        if (!userId || !termId || !classId || !sectionId) {
            return res.status(400).json({ error: 'user_id, term_id, class_id, section_id are required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessClassSection(client, ctx.employeeId, classId, sectionId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section' });
        }

        const metaRes = await client.query(
            `SELECT t.id AS term_id, t.term_name,
                    ay.id AS academic_year_id, ay.year_name,
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name
             FROM academic_terms t
             JOIN academic_years ay ON ay.id = t.academic_year_id
             JOIN classes c ON c.class_id = $2
             JOIN sections sec ON sec.section_id = $3 AND sec.class_id = c.class_id
             WHERE t.id = $1`,
            [termId, classId, sectionId]
        );

        if (metaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid term/class/section selection' });
        }

        const studentsRes = await client.query(
            `SELECT
                s.student_id,
                s.first_name,
                s.last_name,
                s.admission_no,
                s.roll_no,
                COUNT(em.mark_id)::int AS marked_subjects,
                COALESCE(SUM(em.total_marks), 0)::numeric(10,2) AS total_marks,
                COALESCE(SUM(em.obtained_marks), 0)::numeric(10,2) AS obtained_marks
             FROM students s
             LEFT JOIN exam_marks em
               ON em.student_id = s.student_id
              AND em.term_id = $1
              AND em.class_id = $2
              AND em.section_id = $3
             WHERE s.class_id = $2
               AND s.section_id = $3
               AND s.status = 'Active'
             GROUP BY s.student_id, s.first_name, s.last_name, s.admission_no, s.roll_no
             ORDER BY s.roll_no ASC NULLS LAST, s.first_name ASC, s.last_name ASC`,
            [termId, classId, sectionId]
        );

        const rankRows = studentsRes.rows.map(s => ({
            student_id: s.student_id,
            obtained_total: s.obtained_marks,
            total_total: s.total_marks,
            marked_count: s.marked_subjects
        }));
        const rankMap = computeClassRanks(rankRows);

        const studentsWithRanks = studentsRes.rows.map(s => {
            const info = rankMap.get(s.student_id) || { position: null, ordinal_position: null, percentage: null, grade: null };
            return { ...s, ...info };
        });

        res.json({
            meta: metaRes.rows[0],
            students: studentsWithRanks
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.post('/result-card/data', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.body.user_id);
        const termId = Number(req.body.term_id);
        const classId = Number(req.body.class_id);
        const sectionId = Number(req.body.section_id);
        const requestedStudentIds = Array.isArray(req.body.student_ids) ? req.body.student_ids : [];

        if (!userId || !termId || !classId || !sectionId) {
            return res.status(400).json({ error: 'user_id, term_id, class_id, section_id are required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessClassSection(client, ctx.employeeId, classId, sectionId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section' });
        }

        const metaRes = await client.query(
            `SELECT t.id AS term_id, t.term_name,
                    ay.id AS academic_year_id, ay.year_name,
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name
             FROM academic_terms t
             JOIN academic_years ay ON ay.id = t.academic_year_id
             JOIN classes c ON c.class_id = $2
             JOIN sections sec ON sec.section_id = $3 AND sec.class_id = c.class_id
             WHERE t.id = $1`,
            [termId, classId, sectionId]
        );

        if (metaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid term/class/section selection' });
        }

        const teacherRes = await client.query(
            `SELECT e.first_name, e.last_name
             FROM teacher_class_assignment tca
             JOIN employees e ON e.employee_id = tca.employee_id
             WHERE tca.class_id = $1
               AND tca.section_id = $2
               AND tca.is_class_teacher = true
             LIMIT 1`,
            [classId, sectionId]
        );

        const classTeacher = teacherRes.rows.length > 0
            ? `${teacherRes.rows[0].first_name || ''} ${teacherRes.rows[0].last_name || ''}`.trim()
            : '';

        const metaData = {
            ...metaRes.rows[0],
            class_teacher: classTeacher
        };

        let studentIds = requestedStudentIds
            .map(v => Number(v))
            .filter(v => Number.isInteger(v) && v > 0);

        studentIds = [...new Set(studentIds)];

        if (requestedStudentIds.length > 0 && studentIds.length !== requestedStudentIds.length) {
            return res.status(400).json({ error: 'student_ids must contain only valid unique integers' });
        }

        const studentsRes = await client.query(
            `SELECT s.student_id, s.first_name, s.last_name, s.father_name, s.admission_no, s.roll_no
             FROM students s
             WHERE s.class_id = $1
               AND s.section_id = $2
               AND s.status = 'Active'
             ORDER BY s.roll_no ASC NULLS LAST, s.first_name ASC, s.last_name ASC`,
            [classId, sectionId]
        );

        const allStudentIds = studentsRes.rows.map(r => r.student_id);
        if (allStudentIds.length === 0) {
            return res.json({
                meta: metaRes.rows[0],
                school: {},
                subjects: [],
                students: []
            });
        }

        if (studentIds.length === 0) {
            studentIds = allStudentIds;
        } else {
            const allowedSet = new Set(allStudentIds);
            for (const studentId of studentIds) {
                if (!allowedSet.has(studentId)) {
                    return res.status(400).json({ error: `Student ${studentId} does not belong to selected class/section` });
                }
            }
        }

        const subjectsRes = await client.query(
            `SELECT subject_id, subject_name, subject_code
             FROM subjects
             WHERE section_id = $1
             ORDER BY subject_id ASC`,
            [sectionId]
        );

        const marksRes = await client.query(
            `SELECT student_id, subject_id, total_marks, obtained_marks
             FROM exam_marks
             WHERE term_id = $1
               AND class_id = $2
               AND section_id = $3
               AND student_id = ANY($4::int[])`,
            [termId, classId, sectionId, studentIds]
        );

        const totalsRes = await client.query(
            `SELECT s.student_id,
                    COALESCE(SUM(em.obtained_marks), 0)::numeric(10,2) AS obtained_total,
                    COALESCE(SUM(em.total_marks), 0)::numeric(10,2) AS total_total,
                    COUNT(em.mark_id)::int AS marked_count
             FROM students s
             LEFT JOIN exam_marks em
               ON em.student_id = s.student_id
              AND em.term_id = $1
              AND em.class_id = $2
              AND em.section_id = $3
             WHERE s.class_id = $2
               AND s.section_id = $3
               AND s.status = 'Active'
             GROUP BY s.student_id
             ORDER BY obtained_total DESC, s.student_id ASC`,
            [termId, classId, sectionId]
        );

        const systemRes = await client.query(
            `SELECT school_name, address, contact_number, logo_url FROM school_settings LIMIT 1`
        );

        const school = {};
        if (systemRes.rows.length > 0) {
            const r = systemRes.rows[0];
            school.school_name = r.school_name || '';
            school.school_address = r.address || '';
            school.phone_number = r.contact_number || '';
            school.school_logo_url = r.logo_url || '';
        }

        const markMap = new Map();
        for (const mark of marksRes.rows) {
            markMap.set(`${mark.student_id}:${mark.subject_id}`, mark);
        }

        const rankMap = computeClassRanks(totalsRes.rows);

        const selectedStudentSet = new Set(studentIds);
        const selectedStudents = studentsRes.rows.filter(s => selectedStudentSet.has(s.student_id));

        const studentCards = selectedStudents.map(student => {
            const subjectRows = subjectsRes.rows.map(subject => {
                const mark = markMap.get(`${student.student_id}:${subject.subject_id}`);
                return {
                    subject_id: subject.subject_id,
                    subject_name: subject.subject_name,
                    subject_code: subject.subject_code,
                    total_marks: mark ? Number(mark.total_marks) : null,
                    obtained_marks: mark ? Number(mark.obtained_marks) : null
                };
            });

            const grandTotalMarks = subjectRows.reduce((sum, row) => sum + (row.total_marks || 0), 0);
            const grandObtainedMarks = subjectRows.reduce((sum, row) => sum + (row.obtained_marks || 0), 0);

            const rankInfo = rankMap.get(student.student_id) || { position: null, ordinal_position: null, percentage: null, grade: null };

            return {
                student_id: student.student_id,
                first_name: student.first_name,
                last_name: student.last_name,
                father_name: student.father_name,
                admission_no: student.admission_no,
                roll_no: student.roll_no,
                position: rankInfo.position,
                ordinal_position: rankInfo.ordinal_position,
                percentage: rankInfo.percentage,
                grade: rankInfo.grade,
                subject_rows: subjectRows,
                grand_total_marks: grandTotalMarks,
                grand_obtained_marks: grandObtainedMarks
            };
        });

        res.json({
            meta: metaData,
            school,
            subjects: subjectsRes.rows,
            students: studentCards
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.delete('/marks/sheet', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.query.user_id);
        const termId = Number(req.query.term_id);
        const classId = Number(req.query.class_id);
        const sectionId = Number(req.query.section_id);
        const subjectId = Number(req.query.subject_id);

        if (!userId || !termId || !classId || !sectionId || !subjectId) {
            return res.status(400).json({ error: 'user_id, term_id, class_id, section_id, subject_id are required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        if (!ctx.isAdmin) {
            return res.status(403).json({ error: 'Only admin can delete marks.' });
        }

        await client.query('BEGIN');

        const delRes = await client.query(
            `DELETE FROM exam_marks
             WHERE term_id = $1
               AND class_id = $2
               AND section_id = $3
               AND subject_id = $4`,
            [termId, classId, sectionId, subjectId]
        );

        await client.query(
            `DELETE FROM exam_mark_locks
             WHERE term_id = $1
               AND class_id = $2
               AND section_id = $3
               AND subject_id = $4`,
            [termId, classId, sectionId, subjectId]
        );

        await client.query('COMMIT');

        res.json({ message: 'Marks sheet deleted successfully.', deleted_rows: delRes.rowCount });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ─── Class Marks Sheet ───────────────────────────────────────────────────────
router.get('/class-marks-sheet', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const userId = parseUserId(req.query.user_id);
        const termId = Number(req.query.term_id);
        const classId = Number(req.query.class_id);
        const sectionId = Number(req.query.section_id);

        if (!userId || !termId || !classId || !sectionId) {
            return res.status(400).json({ error: 'user_id, term_id, class_id, section_id are required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessClassSection(client, ctx.employeeId, classId, sectionId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section' });
        }

        // Meta (term + class + section + year)
        const metaRes = await client.query(
            `SELECT t.id AS term_id, t.term_name,
                    ay.id AS academic_year_id, ay.year_name,
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name
             FROM academic_terms t
             JOIN academic_years ay ON ay.id = t.academic_year_id
             JOIN classes c ON c.class_id = $2
             JOIN sections sec ON sec.section_id = $3 AND sec.class_id = c.class_id
             WHERE t.id = $1`,
            [termId, classId, sectionId]
        );

        if (metaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid term/class/section selection' });
        }

        // All subjects for this section (columns of the sheet)
        const subjectsRes = await client.query(
            `SELECT subject_id, subject_name, subject_code
             FROM subjects
             WHERE section_id = $1
             ORDER BY subject_id ASC`,
            [sectionId]
        );

        // Active students ordered by roll_no
        const studentsRes = await client.query(
            `SELECT student_id, first_name, last_name, admission_no, roll_no
             FROM students
             WHERE class_id = $1
               AND section_id = $2
               AND status = 'Active'
             ORDER BY roll_no ASC NULLS LAST, first_name ASC, last_name ASC`,
            [classId, sectionId]
        );

        if (studentsRes.rows.length === 0) {
            return res.json({
                meta: metaRes.rows[0],
                school: {},
                subjects: subjectsRes.rows,
                students: []
            });
        }

        const allStudentIds = studentsRes.rows.map(r => r.student_id);

        // All marks for these students in this term/class/section
        const marksRes = await client.query(
            `SELECT student_id, subject_id,
                    total_marks::numeric(10,2) AS total_marks,
                    obtained_marks::numeric(10,2) AS obtained_marks
             FROM exam_marks
             WHERE term_id = $1
               AND class_id = $2
               AND section_id = $3
               AND student_id = ANY($4::int[])`,
            [termId, classId, sectionId, allStudentIds]
        );

        // Per-student grand totals for ranking
        const totalsMap = new Map();
        for (const row of studentsRes.rows) {
            totalsMap.set(row.student_id, { student_id: row.student_id, obtained_total: 0, total_total: 0, marked_count: 0 });
        }
        for (const mark of marksRes.rows) {
            const t = totalsMap.get(mark.student_id);
            if (t) {
                t.obtained_total += Number(mark.obtained_marks);
                t.total_total += Number(mark.total_marks);
                t.marked_count += 1;
            }
        }
        const totalsRows = Array.from(totalsMap.values());
        const rankMap = computeClassRanks(totalsRows);

        // mark lookup keyed by "student_id:subject_id"
        const markMap = new Map();
        for (const mark of marksRes.rows) {
            markMap.set(`${mark.student_id}:${mark.subject_id}`, mark);
        }

        // School info from General Information settings (school_settings table)
        const systemRes = await client.query(
            `SELECT school_name, address, contact_number, logo_url FROM school_settings LIMIT 1`
        );
        const school = {};
        if (systemRes.rows.length > 0) {
            const r = systemRes.rows[0];
            school.school_name = r.school_name || '';
            school.school_address = r.address || '';
            school.phone_number = r.contact_number || '';
            school.school_logo_url = r.logo_url || '';
        }

        // Build student rows
        const students = studentsRes.rows.map(student => {
            const subjectMarks = subjectsRes.rows.map(subject => {
                const mark = markMap.get(`${student.student_id}:${subject.subject_id}`);
                return {
                    subject_id: subject.subject_id,
                    obtained_marks: mark ? Number(mark.obtained_marks) : null,
                    total_marks: mark ? Number(mark.total_marks) : null
                };
            });

            const tot = totalsMap.get(student.student_id);
            const rankInfo = rankMap.get(student.student_id) || {
                position: null, ordinal_position: null, percentage: null, grade: null
            };

            return {
                student_id: student.student_id,
                first_name: student.first_name,
                last_name: student.last_name,
                admission_no: student.admission_no,
                roll_no: student.roll_no,
                subject_marks: subjectMarks,
                grand_obtained: tot ? tot.obtained_total : 0,
                grand_total: tot ? tot.total_total : 0,
                position: rankInfo.position,
                ordinal_position: rankInfo.ordinal_position,
                percentage: rankInfo.percentage,
                grade: rankInfo.grade
            };
        });

        res.json({
            meta: metaRes.rows[0],
            school,
            subjects: subjectsRes.rows,
            students
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ACADEMICS Full Performance View for Profile Page
// ─────────────────────────────────────────────────────────────────────────────

router.get('/student-academics/:student_id', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();

        const studentId = Number(req.params.student_id);
        if (!Number.isInteger(studentId) || studentId <= 0) {
            return res.status(400).json({ error: 'Invalid student_id' });
        }

        // ── 1. Term-wise marks (from exam_marks) ────────────────────────────
        const termMarksRes = await client.query(
            `SELECT
                em.mark_id,
                em.obtained_marks,
                em.total_marks,
                s.subject_id, s.subject_name, s.subject_code,
                t.id AS term_id, t.term_name,
                ay.id AS academic_year_id, ay.year_name,
                em.updated_at
             FROM exam_marks em
             JOIN subjects s ON s.subject_id = em.subject_id
             JOIN academic_terms t ON t.id = em.term_id
             JOIN academic_years ay ON ay.id = t.academic_year_id
             WHERE em.student_id = $1 AND em.status = 'published'
             ORDER BY ay.id ASC, t.id ASC, s.subject_name ASC`,
            [studentId]
        );

        // ── 2. Test marks (from test_marks + test_papers) ────────────────────
        const testMarksRes = await client.query(
            `SELECT
                tm.test_mark_id,
                tm.obtained_marks,
                tm.remarks,
                tp.test_id, tp.test_name, tp.description, tp.total_marks,
                tp.created_at AS test_date,
                s.subject_id, s.subject_name, s.subject_code,
                c.class_name, sec.section_name
             FROM test_marks tm
             JOIN test_papers tp ON tp.test_id = tm.test_id
             JOIN subjects s ON s.subject_id = tp.subject_id
             JOIN classes c ON c.class_id = tp.class_id
             JOIN sections sec ON sec.section_id = tp.section_id
             WHERE tm.student_id = $1
               AND tp.status = 'published'
               AND tm.obtained_marks IS NOT NULL
             ORDER BY tp.created_at ASC`,
            [studentId]
        );

        // ── 3. Attendance summary (for prediction weighting) ─────────────────
        const attRes = await client.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
                COUNT(*) FILTER (WHERE status = 'Absent')::int  AS absent,
                COUNT(*) FILTER (WHERE status = 'Late')::int    AS late,
                COUNT(*) FILTER (WHERE status = 'Leave')::int   AS leave,
                COUNT(*)::int AS total
             FROM student_attendance
             WHERE student_id = $1`,
            [studentId]
        );

        const att = attRes.rows[0] || { present: 0, absent: 0, late: 0, leave: 0, total: 0 };

        // ── Build term groups ────────────────────────────────────────────────
        const termMap = new Map();
        for (const row of termMarksRes.rows) {
            const key = `${row.academic_year_id}_${row.term_id}`;
            if (!termMap.has(key)) {
                termMap.set(key, {
                    term_id: row.term_id,
                    term_name: row.term_name,
                    year_name: row.year_name,
                    academic_year_id: row.academic_year_id,
                    subjects: []
                });
            }
            const pct = row.total_marks > 0 ? +((row.obtained_marks / row.total_marks) * 100).toFixed(1) : 0;
            termMap.get(key).subjects.push({
                subject_id: row.subject_id,
                subject_name: row.subject_name,
                subject_code: row.subject_code,
                obtained_marks: +Number(row.obtained_marks).toFixed(1),
                total_marks: +Number(row.total_marks).toFixed(1),
                percentage: pct,
                grade: gradeFromPct(pct)
            });
        }

        const terms = Array.from(termMap.values()).map(term => {
            const totalObtained = term.subjects.reduce((s, r) => s + r.obtained_marks, 0);
            const totalPossible = term.subjects.reduce((s, r) => s + r.total_marks, 0);
            const termPct = totalPossible > 0 ? +((totalObtained / totalPossible) * 100).toFixed(1) : 0;
            return {
                ...term,
                total_obtained: +totalObtained.toFixed(1),
                total_possible: +totalPossible.toFixed(1),
                term_percentage: termPct,
                term_grade: gradeFromPct(termPct)
            };
        });

        // ── Build test groups by subject ─────────────────────────────────────
        const testsBySubject = new Map();
        for (const row of testMarksRes.rows) {
            if (!testsBySubject.has(row.subject_id)) {
                testsBySubject.set(row.subject_id, {
                    subject_id: row.subject_id,
                    subject_name: row.subject_name,
                    subject_code: row.subject_code,
                    tests: []
                });
            }
            const pct = row.total_marks > 0 ? +((row.obtained_marks / row.total_marks) * 100).toFixed(1) : 0;
            testsBySubject.get(row.subject_id).tests.push({
                test_id: row.test_id,
                test_name: row.test_name,
                description: row.description,
                total_marks: +Number(row.total_marks).toFixed(1),
                obtained_marks: +Number(row.obtained_marks).toFixed(1),
                remarks: row.remarks,
                percentage: pct,
                grade: gradeFromPct(pct),
                test_date: row.test_date
            });
        }
        const testSubjects = Array.from(testsBySubject.values()).map(sub => {
            const avg = sub.tests.reduce((s, t) => s + t.percentage, 0) / (sub.tests.length || 1);
            return { ...sub, avg_percentage: +avg.toFixed(1), avg_grade: gradeFromPct(avg) };
        });

        // ── Performance Prediction ───────────────────────────────────────────
        // Uses weighted-average algorithm:
        //   • term marks      → 65% weight
        //   • test/quiz marks → 25% weight
        //   • attendance      → 10% weight
        const termPcts = terms.map(t => t.term_percentage);
        const testPcts = testMarksRes.rows.map(r => r.total_marks > 0 ? (r.obtained_marks / r.total_marks) * 100 : 0);
        const attPct = att.total > 0 ? ((att.present + att.late * 0.5) / att.total) * 100 : null;

        const termAvg = termPcts.length ? termPcts.reduce((a, b) => a + b, 0) / termPcts.length : null;
        const testAvg = testPcts.length ? testPcts.reduce((a, b) => a + b, 0) / testPcts.length : null;

        // Weighted composite
        let composite = null;
        let compositeWeights = 0;
        if (termAvg !== null) { composite = (composite || 0) + termAvg * 65; compositeWeights += 65; }
        if (testAvg !== null) { composite = (composite || 0) + testAvg * 25; compositeWeights += 25; }
        if (attPct !== null) { composite = (composite || 0) + attPct * 10; compositeWeights += 10; }
        if (composite !== null && compositeWeights > 0) composite = +(composite / compositeWeights).toFixed(1);

        // Trend analysis linear regression slope on term percentages
        let trend = 'insufficient_data';
        let trendSlope = 0;
        if (termPcts.length >= 2) {
            const n = termPcts.length;
            const xMean = (n - 1) / 2;
            const yMean = termPcts.reduce((a, b) => a + b, 0) / n;
            const num = termPcts.reduce((s, y, i) => s + (i - xMean) * (y - yMean), 0);
            const den = termPcts.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
            trendSlope = den !== 0 ? +(num / den).toFixed(2) : 0;
            if (trendSlope > 3) trend = 'improving';
            else if (trendSlope < -3) trend = 'declining';
            else trend = 'stable';
        }

        // Next term prediction = last term pct + smoothed slope (capped 0-100)
        let predicted_next = null;
        if (termPcts.length >= 1) {
            const last = termPcts[termPcts.length - 1];
            predicted_next = +Math.min(100, Math.max(0, last + trendSlope)).toFixed(1);
        }

        const prediction = {
            composite_score: composite,
            composite_grade: composite !== null ? gradeFromPct(composite) : null,
            level: composite !== null ? levelFromPct(composite) : 'No Data',
            trend,
            trend_slope: trendSlope,
            predicted_next,
            predicted_grade: predicted_next !== null ? gradeFromPct(predicted_next) : null,
            term_avg: termAvg !== null ? +termAvg.toFixed(1) : null,
            test_avg: testAvg !== null ? +testAvg.toFixed(1) : null,
            attendance_pct: attPct !== null ? +attPct.toFixed(1) : null,
            data_points: termPcts.length
        };

        res.json({ terms, test_subjects: testSubjects, prediction, attendance: att });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

function gradeFromPct(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
}

function levelFromPct(pct) {
    if (pct >= 90) return 'Outstanding';
    if (pct >= 80) return 'Excellent';
    if (pct >= 70) return 'Good';
    if (pct >= 60) return 'Average';
    if (pct >= 50) return 'Below Average';
    return 'Poor';
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST MARKING Tables + Routes
// ─────────────────────────────────────────────────────────────────────────────

let ensureTestTablesPromise = null;

async function ensureTestTables() {
    if (!ensureTestTablesPromise) {
        ensureTestTablesPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS test_papers (
                    test_id SERIAL PRIMARY KEY,
                    test_name VARCHAR(200) NOT NULL,
                    description TEXT,
                    total_marks NUMERIC(10,2) NOT NULL CHECK (total_marks > 0),
                    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                    section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                    created_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                    created_by_employee_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS test_marks (
                    test_mark_id SERIAL PRIMARY KEY,
                    test_id INTEGER NOT NULL REFERENCES test_papers(test_id) ON DELETE CASCADE,
                    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                    obtained_marks NUMERIC(10,2) CHECK (obtained_marks >= 0),
                    remarks VARCHAR(300),
                    UNIQUE(test_id, student_id)
                );
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS test_paper_locks (
                    lock_id SERIAL PRIMARY KEY,
                    test_id INTEGER NOT NULL REFERENCES test_papers(test_id) ON DELETE CASCADE,
                    locked_by_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(test_id, locked_by_user_id)
                );
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_test_papers_class_sec_sub ON test_papers(class_id, section_id, subject_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_test_marks_test_student ON test_marks(test_id, student_id);`);
        })();
    }
    return ensureTestTablesPromise;
}

// GET /tests/context
router.get('/tests/context', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTestTables();
        const userId = parseUserId(req.query.user_id);
        if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        let classes = [], sections = [], subjects = [];

        // Admin (>=90) and Supervisor (>=65) can see all classes
        if (ctx.isAdmin || ctx.isSupervisor) {
            const classRes = await client.query(`SELECT class_id, class_name FROM classes ORDER BY class_name ASC`);
            const sectionRes = await client.query(`SELECT section_id, section_name, class_id FROM sections ORDER BY class_id, section_name ASC`);
            const subjectRes = await client.query(
                `SELECT s.subject_id, s.subject_name, s.subject_code,
                        sec.section_id, sec.section_name,
                        c.class_id, c.class_name
                 FROM subjects s
                 JOIN sections sec ON sec.section_id = s.section_id
                 JOIN classes c ON c.class_id = sec.class_id
                 ORDER BY c.class_name, sec.section_name, s.subject_name`
            );
            classes = classRes.rows;
            sections = sectionRes.rows;
            subjects = subjectRes.rows;
        } else {
            if (!ctx.employeeId) {
                return res.json({ is_admin: false, classes: [], sections: [], subjects: [] });
            }
            const scopeRes = await client.query(
                `SELECT DISTINCT
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name,
                    s.subject_id, s.subject_name, s.subject_code
                 FROM teacher_subject_assignment tsa
                 JOIN subjects s ON s.subject_id = tsa.subject_id
                 JOIN sections sec ON sec.section_id = s.section_id
                 JOIN classes c ON c.class_id = sec.class_id
                 WHERE tsa.employee_id = $1

                 UNION

                 SELECT DISTINCT
                    c.class_id, c.class_name,
                    sec.section_id, sec.section_name,
                    NULL::int as subject_id, NULL::varchar as subject_name, NULL::varchar as subject_code
                 FROM teacher_class_assignment tca
                 JOIN classes c ON c.class_id = tca.class_id
                 JOIN sections sec ON sec.section_id = tca.section_id
                 WHERE tca.employee_id = $1 AND tca.is_class_teacher = true

                 ORDER BY class_name, section_name, subject_name`,
                [ctx.employeeId]
            );
            const classMap = new Map(), sectionMap = new Map();
            for (const row of scopeRes.rows) {
                classMap.set(row.class_id, { class_id: row.class_id, class_name: row.class_name });
                sectionMap.set(row.section_id, { section_id: row.section_id, section_name: row.section_name, class_id: row.class_id });
            }
            classes = Array.from(classMap.values());
            sections = Array.from(sectionMap.values());
            subjects = scopeRes.rows.map(r => ({
                subject_id: r.subject_id, subject_name: r.subject_name, subject_code: r.subject_code,
                section_id: r.section_id, section_name: r.section_name,
                class_id: r.class_id, class_name: r.class_name
            }));
        }

        res.json({ is_admin: ctx.isAdmin, classes, sections, subjects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /tests?user_id=&class_id=&section_id=&subject_id=
router.get('/tests', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTestTables();
        const userId = parseUserId(req.query.user_id);
        const classId = Number(req.query.class_id);
        const sectionId = Number(req.query.section_id);
        const subjectId = Number(req.query.subject_id);

        if (!userId || !classId || !sectionId || !subjectId) {
            return res.status(400).json({ error: 'user_id, class_id, section_id, subject_id are required' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessSheet(client, ctx.employeeId, classId, sectionId, subjectId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });
        }

        const testsRes = await client.query(
            `SELECT tp.test_id, tp.test_name, tp.description, tp.total_marks, tp.created_at,
                    COALESCE(e.first_name || ' ' || e.last_name, 'Admin') AS created_by_name,
                    (SELECT COUNT(*) FROM test_marks tm WHERE tm.test_id = tp.test_id AND tm.obtained_marks IS NOT NULL)::int AS marks_entered
             FROM test_papers tp
             LEFT JOIN employees e ON e.employee_id = tp.created_by_employee_id
             WHERE tp.class_id = $1 AND tp.section_id = $2 AND tp.subject_id = $3
             ORDER BY tp.created_at DESC`,
            [classId, sectionId, subjectId]
        );

        res.json({ tests: testsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /tests
router.post('/tests', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTestTables();
        const userId = parseUserId(req.body.user_id);
        const classId = Number(req.body.class_id);
        const sectionId = Number(req.body.section_id);
        const subjectId = Number(req.body.subject_id);
        const testName = String(req.body.test_name || '').trim();
        const description = String(req.body.description || '').trim() || null;
        const totalMarks = Number(req.body.total_marks);

        if (!userId || !classId || !sectionId || !subjectId) {
            return res.status(400).json({ error: 'user_id, class_id, section_id, subject_id are required' });
        }
        if (!testName) return res.status(400).json({ error: 'test_name is required' });
        if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
            return res.status(400).json({ error: 'total_marks must be greater than 0' });
        }

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessSheet(client, ctx.employeeId, classId, sectionId, subjectId);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });
        }

        const insertRes = await client.query(
            `INSERT INTO test_papers (test_name, description, total_marks, class_id, section_id, subject_id, created_by_user_id, created_by_employee_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING test_id`,
            [testName, description, totalMarks, classId, sectionId, subjectId, userId, ctx.employeeId]
        );

        res.status(201).json({ test_id: insertRes.rows[0].test_id, message: 'Test created successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /tests/:test_id/sheet?user_id=
router.get('/tests/:test_id/sheet', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTestTables();
        const userId = parseUserId(req.query.user_id);
        const testId = Number(req.params.test_id);

        if (!userId || !testId) return res.status(400).json({ error: 'Valid user_id and test_id are required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        const testRes = await client.query(
            `SELECT tp.*, sub.subject_name, sub.subject_code, c.class_name, sec.section_name
             FROM test_papers tp
             JOIN subjects sub ON sub.subject_id = tp.subject_id
             JOIN sections sec ON sec.section_id = tp.section_id
             JOIN classes c ON c.class_id = tp.class_id
             WHERE tp.test_id = $1`,
            [testId]
        );
        if (testRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

        const test = testRes.rows[0];

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessSheet(client, ctx.employeeId, test.class_id, test.section_id, test.subject_id);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });
        }

        const studentsRes = await client.query(
            `SELECT s.student_id, s.first_name, s.last_name, s.admission_no, s.roll_no,
                    tm.test_mark_id, tm.obtained_marks, tm.remarks
             FROM students s
             LEFT JOIN test_marks tm ON tm.student_id = s.student_id AND tm.test_id = $1
             WHERE s.class_id = $2 AND s.section_id = $3 AND s.status = 'Active'
             ORDER BY s.roll_no ASC NULLS LAST, s.first_name ASC, s.last_name ASC`,
            [testId, test.class_id, test.section_id]
        );

        const lockRes = await client.query(
            `SELECT lock_id FROM test_paper_locks WHERE test_id = $1 AND locked_by_user_id = $2 LIMIT 1`,
            [testId, userId]
        );

        const readonly = !ctx.isAdmin && lockRes.rows.length > 0;

        res.json({ test, readonly, students: studentsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /tests/:test_id/save
router.post('/tests/:test_id/save', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTestTables();
        const userId = parseUserId(req.body.user_id);
        const testId = Number(req.params.test_id);
        const marks = Array.isArray(req.body.marks) ? req.body.marks : [];

        if (!userId || !testId) return res.status(400).json({ error: 'Valid user_id and test_id are required' });
        if (marks.length === 0) return res.status(400).json({ error: 'marks array is required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        const testRes = await client.query(`SELECT * FROM test_papers WHERE test_id = $1`, [testId]);
        if (testRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

        const test = testRes.rows[0];

        // Allow if: Admin OR Supervisor (Coordinator/Head/VP) OR assigned teacher
        if (!ctx.isAdmin && !ctx.isSupervisor) {
            const allowed = await canTeacherAccessSheet(client, ctx.employeeId, test.class_id, test.section_id, test.subject_id);
            if (!allowed) return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });

            const lockCheck = await client.query(
                `SELECT lock_id FROM test_paper_locks WHERE test_id = $1 AND locked_by_user_id = $2 LIMIT 1`,
                [testId, userId]
            );
            if (lockCheck.rows.length > 0) return res.status(403).json({ error: 'This test is locked. You can only view it now.' });
        }

        const studentIds = [...new Set(marks.map(m => Number(m.student_id)).filter(v => Number.isInteger(v) && v > 0))];
        if (studentIds.length !== marks.length) {
            return res.status(400).json({ error: 'Each mark row must have a unique valid student_id' });
        }

        const validStudentsRes = await client.query(
            `SELECT student_id FROM students
             WHERE class_id = $1 AND section_id = $2 AND status = 'Active' AND student_id = ANY($3::int[])`,
            [test.class_id, test.section_id, studentIds]
        );
        const validSet = new Set(validStudentsRes.rows.map(r => r.student_id));
        for (const id of studentIds) {
            if (!validSet.has(id)) return res.status(400).json({ error: `Student ${id} does not belong to this class/section` });
        }

        const totalMarks = Number(test.total_marks);
        for (const row of marks) {
            if (row.obtained_marks !== null && row.obtained_marks !== '' && row.obtained_marks !== undefined) {
                const obtained = Number(row.obtained_marks);
                if (!Number.isFinite(obtained) || obtained < 0 || obtained > totalMarks) {
                    return res.status(400).json({ error: `Invalid obtained_marks for student ${row.student_id}` });
                }
            }
        }

        await client.query('BEGIN');

        for (const row of marks) {
            const studentId = Number(row.student_id);
            const obtained = (row.obtained_marks !== null && row.obtained_marks !== '' && row.obtained_marks !== undefined)
                ? Number(row.obtained_marks) : null;
            const remarks = String(row.remarks || '').trim() || null;

            await client.query(
                `INSERT INTO test_marks (test_id, student_id, obtained_marks, remarks)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (test_id, student_id)
                 DO UPDATE SET obtained_marks = EXCLUDED.obtained_marks, remarks = EXCLUDED.remarks`,
                [testId, studentId, obtained, remarks]
            );
        }

        if (!ctx.isAdmin) {
            await client.query(
                `INSERT INTO test_paper_locks (test_id, locked_by_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [testId, userId]
            );
        }

        await client.query('COMMIT');

        res.json({
            message: ctx.isAdmin
                ? 'Marks saved successfully.'
                : 'Marks saved and locked. You can only view them now.',
            locked: !ctx.isAdmin
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// DELETE /tests/:test_id admin only
router.delete('/tests/:test_id', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTestTables();
        const userId = parseUserId(req.query.user_id);
        const testId = Number(req.params.test_id);

        if (!userId || !testId) return res.status(400).json({ error: 'Valid user_id and test_id are required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admin can delete test papers.' });

        const delRes = await client.query(`DELETE FROM test_papers WHERE test_id = $1`, [testId]);
        if (delRes.rowCount === 0) return res.status(404).json({ error: 'Test not found' });

        res.json({ message: 'Test deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MARKS APPROVAL & PUBLISHING WORKFLOW ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /exams/approvals/list?user_id=
router.get('/approvals/list', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();
        await ensureTestTables();

        const userId = parseUserId(req.query.user_id);
        if (!userId) return res.status(400).json({ error: 'Valid user_id is required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        // 1. Term Exam Sheets
        const termSheetsRes = await client.query(`
            SELECT 
                'term_exam' AS sheet_type,
                em.term_id, t.term_name,
                em.class_id, c.class_name,
                em.section_id, sec.section_name,
                em.subject_id, sub.subject_name,
                NULL::int AS test_id,
                CONCAT(t.term_name, ' - ', sub.subject_name) AS sheet_name,
                COUNT(DISTINCT em.student_id)::int AS total_students,
                COALESCE(esa.status, MAX(em.status), 'pending') AS status,
                COALESCE(u_sub.full_name, u_sub.username, 'Teacher') AS submitted_by,
                COALESCE(esa.submitted_at, MAX(em.created_at)) AS submitted_at,
                u_app.full_name AS approved_by,
                esa.approved_at,
                u_pub.full_name AS published_by,
                esa.published_at
            FROM exam_marks em
            JOIN classes c ON c.class_id = em.class_id
            JOIN sections sec ON sec.section_id = em.section_id
            JOIN subjects sub ON sub.subject_id = em.subject_id
            JOIN academic_terms t ON t.id = em.term_id
            LEFT JOIN exam_sheet_approvals esa 
                ON esa.sheet_type = 'term_exam' 
               AND esa.term_id = em.term_id 
               AND esa.class_id = em.class_id 
               AND esa.section_id = em.section_id 
               AND esa.subject_id = em.subject_id
            LEFT JOIN app_users u_sub ON u_sub.id = COALESCE(esa.submitted_by, em.entered_by_user_id)
            LEFT JOIN app_users u_app ON u_app.id = esa.approved_by
            LEFT JOIN app_users u_pub ON u_pub.id = esa.published_by
            GROUP BY em.term_id, t.term_name, em.class_id, c.class_name, em.section_id, sec.section_name, em.subject_id, sub.subject_name, esa.status, esa.submitted_at, esa.approved_at, esa.published_at, u_sub.full_name, u_sub.username, u_app.full_name, u_pub.full_name
            ORDER BY c.class_name ASC, sec.section_name ASC, t.term_name ASC, sub.subject_name ASC
        `);

        // 2. Class Test Sheets
        const testSheetsRes = await client.query(`
            SELECT
                'class_test' AS sheet_type,
                NULL::int AS term_id, NULL AS term_name,
                tp.class_id, c.class_name,
                tp.section_id, sec.section_name,
                tp.subject_id, sub.subject_name,
                tp.test_id,
                tp.test_name AS sheet_name,
                (SELECT COUNT(*)::int FROM test_marks tm WHERE tm.test_id = tp.test_id) AS total_students,
                COALESCE(esa.status, tp.status, 'pending') AS status,
                COALESCE(u_sub.full_name, u_sub.username, 'Teacher') AS submitted_by,
                COALESCE(esa.submitted_at, tp.created_at) AS submitted_at,
                COALESCE(u_app.full_name, 'Supervisor') AS approved_by,
                esa.approved_at,
                COALESCE(u_pub.full_name, 'Admin') AS published_by,
                esa.published_at
            FROM test_papers tp
            JOIN classes c ON c.class_id = tp.class_id
            JOIN sections sec ON sec.section_id = tp.section_id
            JOIN subjects sub ON sub.subject_id = tp.subject_id
            LEFT JOIN exam_sheet_approvals esa ON esa.sheet_type = 'class_test' AND esa.test_id = tp.test_id
            LEFT JOIN app_users u_sub ON u_sub.id = COALESCE(esa.submitted_by, tp.created_by_user_id)
            LEFT JOIN app_users u_app ON u_app.id = COALESCE(esa.approved_by, tp.approved_by)
            LEFT JOIN app_users u_pub ON u_pub.id = COALESCE(esa.published_by, tp.published_by)
            ORDER BY tp.created_at DESC
        `);

        const allSheets = [...termSheetsRes.rows, ...testSheetsRes.rows];
        res.json({ sheets: allSheets, role_level: ctx.user.role_level, role_name: ctx.user.role_name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /exams/approvals/sheet-details?user_id=&sheet_type=&term_id=&class_id=&section_id=&subject_id=&test_id=
router.get('/approvals/sheet-details', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();
        await ensureTestTables();

        const userId = parseUserId(req.query.user_id);
        const { sheet_type, term_id, class_id, section_id, subject_id, test_id } = req.query;

        if (!userId || !sheet_type) return res.status(400).json({ error: 'user_id and sheet_type are required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        if (sheet_type === 'term_exam') {
            const termId = Number(term_id);
            const classId = Number(class_id);
            const sectionId = Number(section_id);
            const subjectId = Number(subject_id);

            const metaRes = await client.query(
                `SELECT t.term_name, c.class_name, sec.section_name, sub.subject_name,
                        esa.status, esa.submitted_at, esa.approved_at, esa.published_at,
                        u_sub.full_name AS submitted_by, u_app.full_name AS approved_by, u_pub.full_name AS published_by
                 FROM academic_terms t
                 JOIN classes c ON c.class_id = $2
                 JOIN sections sec ON sec.section_id = $3
                 JOIN subjects sub ON sub.subject_id = $4
                 LEFT JOIN exam_sheet_approvals esa 
                    ON esa.sheet_type = 'term_exam' AND esa.term_id = $1 AND esa.class_id = $2 AND esa.section_id = $3 AND esa.subject_id = $4
                 LEFT JOIN app_users u_sub ON u_sub.id = esa.submitted_by
                 LEFT JOIN app_users u_app ON u_app.id = esa.approved_by
                 LEFT JOIN app_users u_pub ON u_pub.id = esa.published_by
                 WHERE t.id = $1`,
                [termId, classId, sectionId, subjectId]
            );

            const studentsRes = await client.query(
                `SELECT s.student_id, s.admission_no, s.roll_no,
                        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                        COALESCE(em.obtained_marks, 0) AS obtained_marks,
                        COALESCE(em.total_marks, 100) AS total_marks,
                        em.status AS mark_status
                 FROM students s
                 LEFT JOIN exam_marks em ON em.student_id = s.student_id AND em.term_id = $1 AND em.subject_id = $4
                 WHERE s.class_id = $2 AND s.section_id = $3 AND LOWER(s.status) = 'active'
                 ORDER BY s.roll_no ASC NULLS LAST, s.first_name ASC`,
                [termId, classId, sectionId, subjectId]
            );

            const status = metaRes.rows[0]?.status || studentsRes.rows[0]?.mark_status || 'pending';
            return res.json({
                meta: { ...(metaRes.rows[0] || {}), status },
                students: studentsRes.rows
            });

        } else if (sheet_type === 'class_test') {
            const testId = Number(test_id);
            const metaRes = await client.query(
                `SELECT tp.test_id, tp.test_name, tp.total_marks, c.class_name, sec.section_name, sub.subject_name,
                        COALESCE(esa.status, tp.status, 'pending') AS status,
                        esa.submitted_at, esa.approved_at, esa.published_at,
                        u_sub.full_name AS submitted_by, u_app.full_name AS approved_by, u_pub.full_name AS published_by
                 FROM test_papers tp
                 JOIN classes c ON c.class_id = tp.class_id
                 JOIN sections sec ON sec.section_id = tp.section_id
                 JOIN subjects sub ON sub.subject_id = tp.subject_id
                 LEFT JOIN exam_sheet_approvals esa ON esa.sheet_type = 'class_test' AND esa.test_id = tp.test_id
                 LEFT JOIN app_users u_sub ON u_sub.id = COALESCE(esa.submitted_by, tp.created_by_user_id)
                 LEFT JOIN app_users u_app ON u_app.id = COALESCE(esa.approved_by, tp.approved_by)
                 LEFT JOIN app_users u_pub ON u_pub.id = COALESCE(esa.published_by, tp.published_by)
                 WHERE tp.test_id = $1`,
                [testId]
            );
            if (metaRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

            const test = metaRes.rows[0];
            const studentsRes = await client.query(
                `SELECT s.student_id, s.admission_no, s.roll_no,
                        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                        COALESCE(tm.obtained_marks, 0) AS obtained_marks,
                        $2::numeric AS total_marks, tm.remarks
                 FROM students s
                 LEFT JOIN test_marks tm ON tm.student_id = s.student_id AND tm.test_id = $1
                 WHERE s.class_id = (SELECT class_id FROM test_papers WHERE test_id = $1)
                   AND s.section_id = (SELECT section_id FROM test_papers WHERE test_id = $1)
                   AND LOWER(s.status) = 'active'
                 ORDER BY s.roll_no ASC NULLS LAST, s.first_name ASC`,
                [testId, test.total_marks]
            );

            return res.json({
                meta: test,
                students: studentsRes.rows
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /exams/approvals/update-marks
router.post('/approvals/update-marks', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();
        await ensureTestTables();

        const { user_id, sheet_type, term_id, class_id, section_id, subject_id, test_id, marks } = req.body;
        const userId = parseUserId(user_id);
        if (!userId || !Array.isArray(marks)) return res.status(400).json({ error: 'Valid user_id and marks array are required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        if ((ctx.user.role_level || 0) < 65 && !ctx.isAdmin) {
            return res.status(403).json({ error: 'Only Head Teachers, Coordinators, Vice Principals, Principals, or Administrators can adjust marks.' });
        }

        await client.query('BEGIN');

        if (sheet_type === 'term_exam') {
            const termId = Number(term_id);
            const classId = Number(class_id);
            const sectionId = Number(section_id);
            const subjectId = Number(subject_id);

            const yearRes = await getActiveAcademicYear(client);
            const academicYearId = yearRes?.id || null;

            for (const row of marks) {
                const studentId = Number(row.student_id);
                const obtained = Number(row.obtained_marks);
                const totalMarks = Number(row.total_marks || 100);

                await client.query(
                    `INSERT INTO exam_marks (
                        student_id, subject_id, term_id, academic_year_id,
                        class_id, section_id, total_marks, obtained_marks,
                        status, entered_by_user_id, updated_at
                     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW())
                     ON CONFLICT (student_id, subject_id, term_id)
                     DO UPDATE SET
                        obtained_marks = EXCLUDED.obtained_marks,
                        updated_at = NOW()`,
                    [studentId, subjectId, termId, academicYearId, classId, sectionId, totalMarks, obtained, userId]
                );
            }
        } else if (sheet_type === 'class_test') {
            const testId = Number(test_id);
            for (const row of marks) {
                const studentId = Number(row.student_id);
                const obtained = (row.obtained_marks !== null && row.obtained_marks !== '' && row.obtained_marks !== undefined)
                    ? Number(row.obtained_marks) : null;
                const remarks = row.remarks || null;

                await client.query(
                    `INSERT INTO test_marks (test_id, student_id, obtained_marks, remarks)
                     VALUES ($1,$2,$3,$4)
                     ON CONFLICT (test_id, student_id)
                     DO UPDATE SET obtained_marks = EXCLUDED.obtained_marks, remarks = EXCLUDED.remarks`,
                    [testId, studentId, obtained, remarks]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Marks updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /exams/approvals/change-status
router.post('/approvals/change-status', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureTables();
        await ensureTestTables();

        const { user_id, sheet_type, term_id, class_id, section_id, subject_id, test_id, action } = req.body;
        const userId = parseUserId(user_id);
        if (!userId || !sheet_type || !action) return res.status(400).json({ error: 'user_id, sheet_type, and action are required' });

        const ctx = await getUserContext(client, userId);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

        const roleLevel = Number(ctx.user.role_level || 0);

        // Permission enforcement:
        // publish or unpublish: MUST BE Vice Principal, Principal, or Administrator (role_level >= 90 or Admin)
        if (action === 'publish' || action === 'unpublish') {
            if (roleLevel < 90 && !ctx.isAdmin) {
                return res.status(403).json({ error: 'Only Vice Principal, Principal, or Administrator can publish or unpublish marks to Student Portal.' });
            }
        } else if (action === 'approve') {
            if (roleLevel < 65 && !ctx.isAdmin) {
                return res.status(403).json({ error: 'Only Head Teachers, Coordinators, Vice Principals, Principals, or Administrators can approve marks.' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid action. Must be approve, publish, or unpublish' });
        }

        const targetStatus = action === 'approve' ? 'approved' : action === 'publish' ? 'published' : 'pending';

        await client.query('BEGIN');

        if (sheet_type === 'term_exam') {
            const termId = Number(term_id);
            const classId = Number(class_id);
            const sectionId = Number(section_id);
            const subjectId = Number(subject_id);

            if (!termId || !classId || !sectionId || !subjectId || isNaN(termId) || isNaN(classId) || isNaN(sectionId) || isNaN(subjectId)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Valid term_id, class_id, section_id, and subject_id are required for term_exam' });
            }

            // Update exam_marks table status for this sheet
            await client.query(
                `UPDATE exam_marks 
                 SET status = $1, updated_at = NOW()
                 WHERE term_id = $2 AND class_id = $3 AND section_id = $4 AND subject_id = $5`,
                [targetStatus, termId, classId, sectionId, subjectId]
            );

            // Clean UPSERT into exam_sheet_approvals
            const checkRes = await client.query(
                `SELECT id FROM exam_sheet_approvals 
                 WHERE sheet_type = 'term_exam' AND term_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4`,
                [termId, classId, sectionId, subjectId]
            );

            const isApprovedOrPublished = targetStatus === 'approved' || targetStatus === 'published';
            const isPublished = targetStatus === 'published';
            const now = new Date();

            if (checkRes.rows.length === 0) {
                await client.query(
                    `INSERT INTO exam_sheet_approvals (
                        sheet_type, term_id, class_id, section_id, subject_id, status,
                        submitted_by, approved_by, approved_at, published_by, published_at, updated_at
                     ) VALUES ('term_exam', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                    [
                        termId, classId, sectionId, subjectId, targetStatus, userId,
                        isApprovedOrPublished ? userId : null,
                        isApprovedOrPublished ? now : null,
                        isPublished ? userId : null,
                        isPublished ? now : null
                    ]
                );
            } else {
                if (isPublished) {
                    await client.query(
                        `UPDATE exam_sheet_approvals
                         SET status = $1,
                             approved_by = COALESCE(approved_by, $2),
                             approved_at = COALESCE(approved_at, NOW()),
                             published_by = $2,
                             published_at = NOW(),
                             updated_at = NOW()
                         WHERE sheet_type = 'term_exam' AND term_id = $3 AND class_id = $4 AND section_id = $5 AND subject_id = $6`,
                        [targetStatus, userId, termId, classId, sectionId, subjectId]
                    );
                } else if (targetStatus === 'approved') {
                    await client.query(
                        `UPDATE exam_sheet_approvals
                         SET status = $1,
                             approved_by = COALESCE(approved_by, $2),
                             approved_at = COALESCE(approved_at, NOW()),
                             updated_at = NOW()
                         WHERE sheet_type = 'term_exam' AND term_id = $3 AND class_id = $4 AND section_id = $5 AND subject_id = $6`,
                        [targetStatus, userId, termId, classId, sectionId, subjectId]
                    );
                } else {
                    await client.query(
                        `UPDATE exam_sheet_approvals
                         SET status = $1,
                             published_by = NULL,
                             published_at = NULL,
                             updated_at = NOW()
                         WHERE sheet_type = 'term_exam' AND term_id = $2 AND class_id = $3 AND section_id = $4 AND subject_id = $5`,
                        [targetStatus, termId, classId, sectionId, subjectId]
                    );
                }
            }
        } else if (sheet_type === 'class_test') {
            const testId = Number(test_id);
            if (!testId || isNaN(testId)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Valid test_id is required for class_test' });
            }

            const isApprovedOrPublished = targetStatus === 'approved' || targetStatus === 'published';
            const isPublished = targetStatus === 'published';
            const now = new Date();

            // Update test_papers table status
            if (isPublished) {
                await client.query(
                    `UPDATE test_papers 
                     SET status = $1,
                         approved_by = COALESCE(approved_by, $2),
                         published_by = $2
                     WHERE test_id = $3`,
                    [targetStatus, userId, testId]
                );
            } else if (targetStatus === 'approved') {
                await client.query(
                    `UPDATE test_papers 
                     SET status = $1,
                         approved_by = COALESCE(approved_by, $2)
                     WHERE test_id = $3`,
                    [targetStatus, userId, testId]
                );
            } else {
                await client.query(
                    `UPDATE test_papers 
                     SET status = $1,
                         published_by = NULL
                     WHERE test_id = $2`,
                    [targetStatus, testId]
                );
            }

            const testRowRes = await client.query(`SELECT class_id, section_id, subject_id FROM test_papers WHERE test_id = $1`, [testId]);
            const testRow = testRowRes.rows[0] || {};
            const testClassId = Number(testRow.class_id || class_id || 0);
            const testSectionId = Number(testRow.section_id || section_id || 0);
            const testSubjectId = testRow.subject_id ? Number(testRow.subject_id) : (subject_id ? Number(subject_id) : null);

            const checkRes = await client.query(
                `SELECT id FROM exam_sheet_approvals WHERE sheet_type = 'class_test' AND test_id = $1`,
                [testId]
            );

            if (checkRes.rows.length === 0) {
                await client.query(
                    `INSERT INTO exam_sheet_approvals (
                        sheet_type, test_id, class_id, section_id, subject_id, status,
                        submitted_by, approved_by, approved_at, published_by, published_at, updated_at
                     ) VALUES ('class_test', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                    [
                        testId, testClassId, testSectionId, testSubjectId, targetStatus, userId,
                        isApprovedOrPublished ? userId : null,
                        isApprovedOrPublished ? now : null,
                        isPublished ? userId : null,
                        isPublished ? now : null
                    ]
                );
            } else {
                if (isPublished) {
                    await client.query(
                        `UPDATE exam_sheet_approvals
                         SET status = $1,
                             approved_by = COALESCE(approved_by, $2),
                             approved_at = COALESCE(approved_at, NOW()),
                             published_by = $2,
                             published_at = NOW(),
                             updated_at = NOW()
                         WHERE sheet_type = 'class_test' AND test_id = $3`,
                        [targetStatus, userId, testId]
                    );
                } else if (targetStatus === 'approved') {
                    await client.query(
                        `UPDATE exam_sheet_approvals
                         SET status = $1,
                             approved_by = COALESCE(approved_by, $2),
                             approved_at = COALESCE(approved_at, NOW()),
                             updated_at = NOW()
                         WHERE sheet_type = 'class_test' AND test_id = $3`,
                        [targetStatus, userId, testId]
                    );
                } else {
                    await client.query(
                        `UPDATE exam_sheet_approvals
                         SET status = $1,
                             published_by = NULL,
                             published_at = NULL,
                             updated_at = NOW()
                         WHERE sheet_type = 'class_test' AND test_id = $2`,
                        [targetStatus, testId]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: `Sheet status successfully changed to ${targetStatus}` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
