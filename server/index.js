const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const { initScheduler } = require('./scheduler'); // Import Auto Backup Scheduler
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Scheduler
initScheduler();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads')); // Serve uploaded files



// Routes
// Dashboard Route
app.use('/dashboard', require('./routes/dashboard'));
// Student Routes
app.use('/students', require('./routes/students'));
// HRM Routes
app.use('/hrm', require('./routes/hrm'));
// Classes/Sections Routes
app.use('/academic', require('./routes/classes'));
// Subjects Routes
app.use('/academic/subjects', require('./routes/subjects'));
// Teachers Routes (Academic View of Employees)
app.use('/academic/teachers', require('./routes/teachers'));
// Settings Routes
app.use('/settings', require('./routes/settings'));
// Academic Routes
app.use('/academic', require('./routes/academic'));
app.use('/promotion', require('./routes/promotion'));
// Auth Routes
app.use('/auth', require('./routes/auth'));
app.use('/roles', require('./routes/roles'));
app.use('/users', require('./routes/users'));
// System Routes
app.use('/system', require('./routes/system'));
// Expense Routes
app.use('/expense-categories', require('./routes/expense-categories'));
app.use('/expenses', require('./routes/expenses'));
// Fee Module Routes
app.use('/fee-heads', require('./routes/fee-heads'));
app.use('/fee-plans', require('./routes/fee-plans'));
app.use('/fee-slips', require('./routes/fee-slips'));
app.use('/exam-fees', require('./routes/exam-fees')); // Added for Exam Collection Panel
// Attendance Module Routes
app.use('/attendance', require('./routes/attendance'));
// Examination Module Routes
app.use('/exams', require('./routes/exams'));
// Reports Module Routes
app.use('/reports', require('./routes/reports'));
// Notifications Module Route
app.use('/notifications', require('./routes/notifications'));

app.get('/', (req, res) => {
    res.send('Smart School System API is running');
});

// Example route to check DB connection
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ message: 'Database Connected Successfully', time: result.rows[0].now });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: Database connection failed');
    }
});

// Seed root user if not exists
async function seedRootUser() {
    try {
        const check = await pool.query("SELECT id FROM app_users WHERE username = 'root'");
        if (check.rows.length === 0) {
            // Ensure Administrator role exists
            let roleId;
            const roleCheck = await pool.query("SELECT id FROM app_roles WHERE role_name = 'Administrator'");
            if (roleCheck.rows.length === 0) {
                const newRole = await pool.query(
                    "INSERT INTO app_roles (role_name, description, is_system_default) VALUES ('Administrator', 'Full system access', true) RETURNING id"
                );
                roleId = newRole.rows[0].id;
            } else {
                roleId = roleCheck.rows[0].id;
            }

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash('root123', salt);
            await pool.query(
                "INSERT INTO app_users (username, password_hash, full_name, role_id, is_active) VALUES ('root', $1, 'Root Administrator', $2, true)",
                [password_hash, roleId]
            );
            console.log('Root user created: username=root, password=root123');
        }
    } catch (err) {
        console.error('Error seeding root user:', err.message);
    }
}

const { runEssentialMigrations } = require('./migrations');

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server is running on port ${PORT}`);
    await runEssentialMigrations();
    await seedRootUser();
});
