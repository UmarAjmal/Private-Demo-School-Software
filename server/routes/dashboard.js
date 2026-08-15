const express = require('express');
const router = express.Router();
const pool = require('../db');

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============================================================
//  TEACHER DASHBOARD  GET /dashboard/teacher?user_id=
// ============================================================
router.get('/teacher', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    try {
        // Find employee record linked to this app_user
        const empRes = await pool.query(
            `SELECT e.employee_id, e.first_name, e.last_name, e.designation
             FROM employees e WHERE e.app_user_id = $1 LIMIT 1`,
            [user_id]
        );
        const employee = empRes.rows[0] || null;
        const emp_id = employee?.employee_id || null;

        const [
            classesRes,
            subjectsRes,
            todayAttSummaryRes,
            staffTodayRes,
            recentMarkedRes,
            upcomingExamsRes,
        ] = await Promise.all([
            // Assigned classes + student counts
            emp_id ? pool.query(`
                SELECT c.class_id, c.class_name,
                       sec.section_id, sec.section_name,
                       tca.is_class_teacher,
                       COUNT(s.student_id) FILTER (WHERE s.status='Active') AS student_count
                FROM teacher_class_assignment tca
                JOIN classes c ON tca.class_id = c.class_id
                LEFT JOIN sections sec ON tca.section_id = sec.section_id
                LEFT JOIN students s ON s.class_id = c.class_id AND s.section_id = sec.section_id
                WHERE tca.employee_id = $1
                GROUP BY c.class_id, c.class_name, sec.section_id, sec.section_name, tca.is_class_teacher
                ORDER BY c.class_name`, [emp_id])
                : Promise.resolve({ rows: [] }),

            // Assigned subjects
            emp_id ? pool.query(`
                SELECT s.subject_id, s.subject_name, s.subject_code,
                       c.class_name, sec.section_name
                FROM teacher_subject_assignment tsa
                JOIN subjects s ON tsa.subject_id = s.subject_id
                JOIN sections sec ON sec.section_id = s.section_id
                JOIN classes c ON c.class_id = sec.class_id
                WHERE tsa.employee_id = $1
                ORDER BY c.class_name, sec.section_name, s.subject_name`, [emp_id])
                : Promise.resolve({ rows: [] }),

            // Today's attendance summary for teacher's classes
            emp_id ? pool.query(`
                SELECT c.class_name, c.class_id, sec.section_name, sec.section_id,
                       COUNT(s.student_id) FILTER (WHERE s.status='Active') AS total_students,
                       COUNT(sa.attendance_id) FILTER (WHERE sa.attendance_date = CURRENT_DATE AND sa.status='Present') AS present,
                       COUNT(sa.attendance_id) FILTER (WHERE sa.attendance_date = CURRENT_DATE AND sa.status='Absent')  AS absent,
                       COUNT(sa.attendance_id) FILTER (WHERE sa.attendance_date = CURRENT_DATE AND sa.status='Late')    AS late,
                       COUNT(sa.attendance_id) FILTER (WHERE sa.attendance_date = CURRENT_DATE)                         AS marked
                FROM teacher_class_assignment tca
                JOIN classes c ON tca.class_id = c.class_id
                JOIN sections sec ON tca.section_id = sec.section_id
                LEFT JOIN students s ON s.class_id = c.class_id AND s.section_id = sec.section_id
                LEFT JOIN student_attendance sa ON sa.student_id = s.student_id AND sa.attendance_date = CURRENT_DATE
                WHERE tca.employee_id = $1
                GROUP BY c.class_id, c.class_name, sec.section_id, sec.section_name
                ORDER BY c.class_name, sec.section_name`, [emp_id])
                : Promise.resolve({ rows: [] }),

            // Teacher's own attendance today
            emp_id ? pool.query(`
                SELECT status, check_in_time, check_out_time
                FROM staff_attendance
                WHERE employee_id=$1 AND attendance_date=CURRENT_DATE LIMIT 1`, [emp_id])
                : Promise.resolve({ rows: [] }),

            // Last 10 attendance entries made
            emp_id ? pool.query(`
                SELECT sa.attendance_date, c.class_name, sec.section_name,
                       COUNT(sa.attendance_id) FILTER (WHERE sa.status='Present') AS present,
                       COUNT(sa.attendance_id) FILTER (WHERE sa.status='Absent')  AS absent,
                       COUNT(sa.attendance_id)                                     AS total
                FROM teacher_class_assignment tca
                JOIN classes c ON tca.class_id = c.class_id
                JOIN sections sec ON tca.section_id = sec.section_id
                JOIN students st ON st.class_id = c.class_id AND st.section_id = sec.section_id
                JOIN student_attendance sa ON sa.student_id = st.student_id
                WHERE tca.employee_id = $1
                GROUP BY sa.attendance_date, c.class_name, sec.section_name
                ORDER BY sa.attendance_date DESC, c.class_name, sec.section_name LIMIT 10`, [emp_id])
                : Promise.resolve({ rows: [] }),

            // Upcoming exams (exams module placeholder graceful fallback)
            pool.query(`
                SELECT table_name FROM information_schema.tables
                WHERE table_schema='public' AND table_name='exams' LIMIT 1`),
        ]);

        res.json({
            role: 'teacher',
            teacher: employee ? {
                name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Teacher',
                designation: employee.designation || 'Teacher',
                employee_id: employee.employee_id || null,
            } : { name: 'Teacher', designation: 'Teacher', employee_id: null },

            classes: classesRes.rows.map(c => ({
                id: c.class_id,
                class_name: c.class_name,
                section_name: c.section_name || '',
                total_students: parseInt(c.student_count || 0),
                is_class_teacher: !!c.is_class_teacher,
                subject_name: '',
            })),

            subjects: subjectsRes.rows.map(s => ({
                id: s.subject_id,
                subject_name: s.subject_name,
                class_name: s.class_name || '',
                section_name: s.section_name || '',
            })),

            my_att_today: staffTodayRes.rows[0]
                ? { status: staffTodayRes.rows[0].status, check_in: staffTodayRes.rows[0].check_in_time }
                : null,

            class_att_today: todayAttSummaryRes.rows.map(r => ({
                class_id: r.class_id,
                class_name: r.class_name,
                section_name: r.section_name || '',
                total: parseInt(r.total_students || 0),
                present: parseInt(r.present || 0),
                absent: parseInt(r.absent || 0),
                late: parseInt(r.late || 0),
                marked: parseInt(r.marked || 0) > 0 ? 1 : 0,
            })),

            recent_att: recentMarkedRes.rows.map(r => ({
                date: r.attendance_date,
                class_name: r.class_name,
                section_name: r.section_name || '',
                total: parseInt(r.total || 0),
                present: parseInt(r.present || 0),
                absent: parseInt(r.absent || 0),
            })),
        });
    } catch (err) {
        console.error('[Dashboard/Teacher]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ACCOUNTANT / FINANCE DASHBOARD  GET /dashboard/accountant
// ============================================================
router.get('/accountant', async (req, res) => {
    try {
        const [
            todayRes,
            monthRes,
            pendingRes,
            totalStudRes,
            feeChartRes,
            recentPayRes,
            monthlyChartRes,
        ] = await Promise.all([
            pool.query(`
                SELECT COALESCE(SUM(amount_paid),0) AS collected
                FROM fee_payments WHERE payment_date::date = CURRENT_DATE`),

            pool.query(`
                SELECT COALESCE(SUM(amount_paid),0) AS collected
                FROM fee_payments
                WHERE EXTRACT(MONTH FROM payment_date)=EXTRACT(MONTH FROM CURRENT_DATE)
                  AND EXTRACT(YEAR  FROM payment_date)=EXTRACT(YEAR  FROM CURRENT_DATE)`),

            pool.query(`
                SELECT COALESCE(SUM(GREATEST(0,total_amount-paid_amount)),0) AS pending
                FROM monthly_fee_slips WHERE status IN ('unpaid','partial')`),

            pool.query(`SELECT COUNT(*) AS total FROM students WHERE status='Active'`),

            // Daily last 14 days
            pool.query(`
                SELECT payment_date::date AS date, COALESCE(SUM(amount_paid),0) AS amount
                FROM fee_payments
                WHERE payment_date::date >= CURRENT_DATE - INTERVAL '13 days'
                GROUP BY payment_date::date ORDER BY payment_date::date ASC`),

            // Recent 10 payments
            pool.query(`
                SELECT fp.payment_id, fp.amount_paid, fp.payment_date, fp.payment_method,
                       s.first_name||' '||s.last_name AS student_name,
                       s.admission_no, c.class_name, mfs.month, mfs.year, mfs.status AS slip_status
                FROM fee_payments fp
                JOIN monthly_fee_slips mfs ON fp.slip_id=mfs.slip_id
                JOIN students s ON mfs.student_id=s.student_id
                LEFT JOIN classes c ON s.class_id=c.class_id
                ORDER BY fp.payment_date DESC, fp.payment_id DESC LIMIT 10`),

            // Monthly totals last 6 months
            pool.query(`
                SELECT TO_CHAR(DATE_TRUNC('month', payment_date),'Mon YY') AS month_label,
                       COALESCE(SUM(amount_paid),0) AS amount
                FROM fee_payments
                WHERE payment_date >= CURRENT_DATE - INTERVAL '5 months'
                GROUP BY DATE_TRUNC('month', payment_date)
                ORDER BY DATE_TRUNC('month', payment_date) ASC`),

            // Current Month Tuition Billed
            pool.query(`
                SELECT COALESCE(SUM(ms.total_amount), 0) AS total
                FROM monthly_fee_slips ms
                LEFT JOIN students s ON ms.student_id = s.student_id
                WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE)
                  AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')
            `),

            // Current Month Remaining Dues
            pool.query(`
                SELECT COALESCE(SUM(GREATEST(0, ms.total_amount - ms.paid_amount)), 0) AS total
                FROM monthly_fee_slips ms
                LEFT JOIN students s ON ms.student_id = s.student_id
                WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE)
                  AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')
            `),

            // Current Month Expenses
            pool.query(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM expenses
                WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND EXTRACT(YEAR FROM expense_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                  AND (status IS NULL OR LOWER(status) != 'cancelled')
            `),
        ]);

        res.json({
            role: 'accountant',
            stats: {
                today_collected: parseFloat(todayRes.rows[0]?.collected) || 0,
                month_collected: parseFloat(monthRes.rows[0]?.collected) || 0,
                pending_fees: parseFloat(pendingRes.rows[0]?.pending) || 0,
                total_students: parseInt(totalStudRes.rows[0]?.total) || 0,
                this_month_tuition_billed: parseFloat(monthlyChartRes.length ? 0 : 0) || parseFloat((await pool.query(`SELECT COALESCE(SUM(ms.total_amount), 0) AS total FROM monthly_fee_slips ms LEFT JOIN students s ON ms.student_id = s.student_id WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE) AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE) AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')`)).rows[0]?.total || 0),
                this_month_remaining_dues: parseFloat(pendingRes.rows[0]?.pending) || 0,
                this_month_expenses: parseFloat((await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM expense_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND (status IS NULL OR LOWER(status) != 'cancelled')`)).rows[0]?.total || 0),
            },
            fee_chart: feeChartRes.rows.map(r => ({ date: r.date, label: fmt(r.date), amount: parseFloat(r.amount) || 0 })),
            monthly_chart: monthlyChartRes.rows.map(r => ({ label: r.month_label, amount: parseFloat(r.amount) || 0 })),
            recent_payments: recentPayRes.rows,
        });
    } catch (err) {
        console.error('[Dashboard/Accountant]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ADMIN / PRINCIPAL DASHBOARD  GET /dashboard
// ============================================================
router.get('/', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Run all queries in parallel for maximum performance
        const [
            studentsRes,
            teachersRes,
            classesRes,
            pendingFeesRes,
            thisMonthFeeRes,
            todayFeeRes,
            todayStudentAttRes,
            todayStaffAttRes,
            feeChartRes,
            studentAttChartRes,
            staffAttChartRes,
            recentPaymentsRes,
        ] = await Promise.all([

            // 1. Total active students
            pool.query(`SELECT COUNT(*) AS total FROM students WHERE status = 'Active'`),

            // 2. Total active employees (teachers + staff)
            pool.query(`SELECT COUNT(*) AS total FROM employees WHERE status = 'Active'`),

            // 3. Total classes
            pool.query(`SELECT COUNT(*) AS total FROM classes`),

            // 4. Total pending fees (unpaid + partial across all time)
            pool.query(`
                SELECT COALESCE(SUM(GREATEST(0, total_amount - paid_amount)), 0) AS pending
                FROM monthly_fee_slips
                WHERE status IN ('unpaid', 'partial')
            `),

            // 5. This month's fee collected
            pool.query(`
                SELECT COALESCE(SUM(fp.amount_paid), 0) AS collected
                FROM fee_payments fp
                WHERE EXTRACT(MONTH FROM fp.payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND EXTRACT(YEAR  FROM fp.payment_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
            `),

            // 6. Today's fee collected
            pool.query(`
                SELECT COALESCE(SUM(fp.amount_paid), 0) AS collected
                FROM fee_payments fp
                WHERE fp.payment_date::date = CURRENT_DATE
            `),

            // 7. Today's student attendance summary
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'Present') AS present,
                    COUNT(*) FILTER (WHERE status = 'Absent')  AS absent,
                    COUNT(*) FILTER (WHERE status = 'Late')    AS late,
                    COUNT(*) FILTER (WHERE status = 'Leave')   AS on_leave,
                    COUNT(*) AS total
                FROM student_attendance
                WHERE attendance_date = CURRENT_DATE
            `),

            // 8. Today's staff attendance summary
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'Present') AS present,
                    COUNT(*) FILTER (WHERE status = 'Absent')  AS absent,
                    COUNT(*) FILTER (WHERE status = 'Late')    AS late,
                    COUNT(*) AS total
                FROM staff_attendance
                WHERE attendance_date = CURRENT_DATE
            `),

            // 9. Daily fee collection last 30 days
            pool.query(`
                SELECT
                    fp.payment_date::date          AS date,
                    COALESCE(SUM(fp.amount_paid), 0) AS amount
                FROM fee_payments fp
                WHERE fp.payment_date::date >= CURRENT_DATE - INTERVAL '29 days'
                GROUP BY fp.payment_date::date
                ORDER BY fp.payment_date::date ASC
            `),

            // 10. Daily student attendance last 30 days
            pool.query(`
                SELECT
                    attendance_date AS date,
                    COUNT(*) FILTER (WHERE status = 'Present') AS present,
                    COUNT(*) FILTER (WHERE status = 'Absent')  AS absent,
                    COUNT(*) FILTER (WHERE status = 'Late')    AS late,
                    COUNT(*)                                    AS total
                FROM student_attendance
                WHERE attendance_date >= CURRENT_DATE - INTERVAL '29 days'
                GROUP BY attendance_date
                ORDER BY attendance_date ASC
            `),

            // 11. Daily staff attendance last 30 days
            pool.query(`
                SELECT
                    attendance_date AS date,
                    COUNT(*) FILTER (WHERE status = 'Present') AS present,
                    COUNT(*) FILTER (WHERE status = 'Absent')  AS absent,
                    COUNT(*) FILTER (WHERE status = 'Late')    AS late,
                    COUNT(*)                                    AS total
                FROM staff_attendance
                WHERE attendance_date >= CURRENT_DATE - INTERVAL '29 days'
                GROUP BY attendance_date
                ORDER BY attendance_date ASC
            `),

            // 12. Recent fee payments (last 8)
            pool.query(`
                SELECT
                    fp.payment_id,
                    fp.amount_paid,
                    fp.payment_date,
                    fp.payment_method,
                    fp.received_by,
                    s.first_name || ' ' || s.last_name AS student_name,
                    s.admission_no,
                    c.class_name,
                    mfs.month,
                    mfs.year,
                    mfs.status AS slip_status
                FROM fee_payments fp
                JOIN monthly_fee_slips mfs ON fp.slip_id = mfs.slip_id
                JOIN students s ON mfs.student_id = s.student_id
                LEFT JOIN classes c ON s.class_id = c.class_id
                ORDER BY fp.payment_date DESC, fp.payment_id DESC
                LIMIT 8
            `),

            // 13. Current month tuition billed
            pool.query(`
                SELECT COALESCE(SUM(ms.total_amount), 0) AS total
                FROM monthly_fee_slips ms
                LEFT JOIN students s ON ms.student_id = s.student_id
                WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE)
                  AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')
            `),

            // 14. Current month remaining dues
            pool.query(`
                SELECT COALESCE(SUM(GREATEST(0, ms.total_amount - ms.paid_amount)), 0) AS total
                FROM monthly_fee_slips ms
                LEFT JOIN students s ON ms.student_id = s.student_id
                WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE)
                  AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')
            `),

            // 15. Current month expenses
            pool.query(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM expenses
                WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND EXTRACT(YEAR FROM expense_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                  AND (status IS NULL OR LOWER(status) != 'cancelled')
            `),
        ]);

        // ── Format chart dates ──────────────────────────────────────────────
        const fmt = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const feeChart = feeChartRes.rows.map(r => ({
            date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
            label: fmt(r.date),
            amount: parseFloat(r.amount) || 0,
        }));

        const studentAttChart = studentAttChartRes.rows.map(r => ({
            date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
            label: fmt(r.date),
            present: parseInt(r.present) || 0,
            absent: parseInt(r.absent) || 0,
            late: parseInt(r.late) || 0,
            total: parseInt(r.total) || 0,
        }));

        const staffAttChart = staffAttChartRes.rows.map(r => ({
            date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
            label: fmt(r.date),
            present: parseInt(r.present) || 0,
            absent: parseInt(r.absent) || 0,
            late: parseInt(r.late) || 0,
            total: parseInt(r.total) || 0,
        }));

        const todayStudAtt = todayStudentAttRes.rows[0] || {};
        const todayStaffAtt = todayStaffAttRes.rows[0] || {};

        const thisMonthTuitionBilledRes = arguments[0] || {}; // fallback
        const thisMonthBilledVal = parseFloat(recentPaymentsRes[8]?.rows?.[0]?.total || 0) || parseFloat((await pool.query(`SELECT COALESCE(SUM(ms.total_amount), 0) AS total FROM monthly_fee_slips ms LEFT JOIN students s ON ms.student_id = s.student_id WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE) AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE) AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')`)).rows[0]?.total || 0);
        const thisMonthRemainingVal = parseFloat((await pool.query(`SELECT COALESCE(SUM(GREATEST(0, ms.total_amount - ms.paid_amount)), 0) AS total FROM monthly_fee_slips ms LEFT JOIN students s ON ms.student_id = s.student_id WHERE ms.month = EXTRACT(MONTH FROM CURRENT_DATE) AND ms.year = EXTRACT(YEAR FROM CURRENT_DATE) AND (s.category IS NULL OR LOWER(TRIM(s.category)) != 'trusted')`)).rows[0]?.total || 0);
        const thisMonthExpensesVal = parseFloat((await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM expense_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND (status IS NULL OR LOWER(status) != 'cancelled')`)).rows[0]?.total || 0);

        res.json({
            stats: {
                total_students: parseInt(studentsRes.rows[0]?.total) || 0,
                total_staff: parseInt(teachersRes.rows[0]?.total) || 0,
                total_classes: parseInt(classesRes.rows[0]?.total) || 0,
                pending_fees: parseFloat(pendingFeesRes.rows[0]?.pending) || 0,
                this_month_collected: parseFloat(thisMonthFeeRes.rows[0]?.collected) || 0,
                today_collected: parseFloat(todayFeeRes.rows[0]?.collected) || 0,
                this_month_tuition_billed: thisMonthBilledVal,
                this_month_remaining_dues: thisMonthRemainingVal,
                this_month_expenses: thisMonthExpensesVal,
            },
            today_student_att: {
                present: parseInt(todayStudAtt.present) || 0,
                absent: parseInt(todayStudAtt.absent) || 0,
                late: parseInt(todayStudAtt.late) || 0,
                on_leave: parseInt(todayStudAtt.on_leave) || 0,
                total: parseInt(todayStudAtt.total) || 0,
            },
            today_staff_att: {
                present: parseInt(todayStaffAtt.present) || 0,
                absent: parseInt(todayStaffAtt.absent) || 0,
                late: parseInt(todayStaffAtt.late) || 0,
                total: parseInt(todayStaffAtt.total) || 0,
            },
            fee_chart: feeChart,
            student_att_chart: studentAttChart,
            staff_att_chart: staffAttChart,
            recent_payments: recentPaymentsRes.rows,
        });
    } catch (err) {
        console.error('[Dashboard Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET popup attendance details
router.get('/attendance-details', async (req, res) => {
    try {
        const { type, status, class_id, section_id } = req.query;
        if (!type || !status) return res.status(400).json({ error: 'Missing type or status' });

        const targetDate = new Date().toISOString().split('T')[0];

        if (type === 'student') {
            let sql = `
                 SELECT s.first_name || ' ' || COALESCE(s.last_name, '') as name,
                        s.father_name as guardian,
                        c.class_name,
                        sec.section_name,
                        COALESCE(s.father_phone, s.student_mobile) as phone
                 FROM student_attendance sa
                 JOIN students s ON sa.student_id = s.student_id
                 LEFT JOIN classes c ON c.class_id = s.class_id
                 LEFT JOIN sections sec ON sec.section_id = s.section_id
                 WHERE sa.attendance_date = $1 
                   AND sa.status ILIKE $2
                   AND s.status = 'Active'
            `;
            const params = [targetDate, status];
            if (class_id) {
                params.push(class_id);
                sql += ` AND s.class_id = $${params.length}`;
            }
            if (section_id) {
                params.push(section_id);
                sql += ` AND s.section_id = $${params.length}`;
            }
            sql += ` ORDER BY c.class_name, s.first_name`;

            const { rows } = await pool.query(sql, params);
            return res.json(rows);
        } else if (type === 'staff') {
            const { rows } = await pool.query(`
                 SELECT e.first_name || ' ' || COALESCE(e.last_name, '') as name,
                        e.designation as guardian,
                        e.phone
                 FROM staff_attendance sa
                 JOIN employees e ON sa.employee_id = e.employee_id
                 WHERE sa.attendance_date = $1 
                   AND sa.status ILIKE $2
                   AND e.status = 'Active'
                 ORDER BY e.first_name`,
                [targetDate, status]
            );
            return res.json(rows);
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

router.get('/daily-fee-receipts', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const statsQuery = pool.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN is_printed = true THEN amount_paid ELSE 0 END), 0) as printed_amount,
                COALESCE(SUM(CASE WHEN is_printed = false THEN amount_paid ELSE 0 END), 0) as unprinted_amount,
                COUNT(CASE WHEN is_printed = true THEN 1 END) as printed_count,
                COUNT(CASE WHEN is_printed = false THEN 1 END) as unprinted_count,
                COALESCE(SUM(amount_paid), 0) as total_amount
             FROM fee_payments
             WHERE payment_date::date = $1`,
            [targetDate]
        );

        const listQuery = pool.query(
            `SELECT fp.payment_id, fp.amount_paid, fp.payment_date, fp.payment_method, fp.is_printed,
                    s.student_id, s.admission_no, s.first_name||' '||COALESCE(s.last_name, '') AS student_name,
                    c.class_name, mfs.month, mfs.year, mfs.is_family_slip, mfs.family_id
             FROM fee_payments fp
             JOIN monthly_fee_slips mfs ON fp.slip_id=mfs.slip_id
             LEFT JOIN students s ON mfs.student_id=s.student_id
             LEFT JOIN classes c ON s.class_id=c.class_id
             WHERE fp.payment_date::date = $1
             ORDER BY fp.payment_date DESC, fp.payment_id DESC`,
            [targetDate]
        );

        const [statsRes, listRes] = await Promise.all([statsQuery, listQuery]);

        res.json({
            stats: statsRes.rows[0],
            payments: listRes.rows
        });
    } catch (err) {
        console.error('Error fetching daily fee receipts:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
