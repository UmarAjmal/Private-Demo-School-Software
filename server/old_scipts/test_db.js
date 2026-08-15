const pool = require('./db');

async function test() {
    try {
        const student_id = 6;
        const ledger = await pool.query(`
            SELECT afl.*, (afl.total_amount - afl.paid_amount - COALESCE(afl.discount_amount, 0)) AS remaining_amount,
                s.first_name, s.last_name, s.admission_no, s.monthly_fee, s.father_name,
                c.class_name, sec.section_name
            FROM admission_fee_ledger afl
            JOIN students s ON afl.student_id = s.student_id
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            WHERE afl.student_id = $1`, [student_id]);
        console.log("Ledger query successful:", ledger.rows);

        if (ledger.rows.length > 0) {
            const payments = await pool.query(`SELECT * FROM admission_fee_payments WHERE ledger_id=$1 ORDER BY payment_date DESC`, [ledger.rows[0].ledger_id]);
            console.log("Payments query successful:", payments.rows);
        }
    } catch (err) {
        console.error("Database Error:", err.message);
    } finally {
        pool.end();
    }
}

test();
