const pool = require('./db');
const bcrypt = require('bcryptjs');

async function syncStudents() {
    const client = await pool.connect();
    try {
        console.log("Starting sync sequence for existing students...");
        await client.query('BEGIN');

        // Find students without a user login
        const res = await client.query("SELECT * FROM students WHERE user_id IS NULL");
        console.log(`Found ${res.rows.length} students without login credentials.`);

        if (res.rows.length === 0) {
            console.log("All students have login credentials.");
            return;
        }

        // Ensure "Student" role exists
        let roleRes = await client.query("SELECT id FROM app_roles WHERE role_name = 'Student'");
        let role_id = roleRes.rows.length > 0 ? roleRes.rows[0].id : null;
        
        if (!role_id) {
             const newRole = await client.query("INSERT INTO app_roles (role_name, description) VALUES ('Student', 'Standard Access') RETURNING id");
             role_id = newRole.rows[0].id;
        }

        let updated = 0;
        for (const student of res.rows) {
            const username = `STU-${student.admission_no}`;
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash('student123', salt);
            const plain_password = 'student123';
            const full_name = `${student.first_name} ${student.last_name || ''}`.trim();
            const email = student.email || '';

            try {
                // Check if username already exists just in case
                const checkUser = await client.query("SELECT id FROM app_users WHERE username = $1", [username]);
                let user_id;

                if (checkUser.rows.length > 0) {
                    user_id = checkUser.rows[0].id;
                    // Update existing password if needed
                    await client.query(
                        "UPDATE app_users SET password_hash = $1, plain_password = $2 WHERE id = $3", 
                        [password_hash, plain_password, user_id]
                    );
                } else {
                    const newUser = await client.query(
                        `INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id, is_active) 
                         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
                        [username, password_hash, plain_password, full_name, email, role_id]
                    );
                    user_id = newUser.rows[0].id;
                }

                await client.query("UPDATE students SET user_id = $1 WHERE student_id = $2", [user_id, student.student_id]);
                updated++;
            } catch (err) {
                console.error(`Failed to process student ${username}:`, err.message);
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully generated/synced credentials for ${updated} students.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Critical error during sync:", error.message);
    } finally {
        client.release();
        process.exit();
    }
}

syncStudents();