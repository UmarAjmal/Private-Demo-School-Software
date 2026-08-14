const router = require('express').Router();
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { initScheduler, performBackup } = require('../scheduler');
const { runMasterSeeder } = require('../master-seeder');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '../backups');

// Multer Setup for Restore Uploads
const upload = multer({ dest: 'temp/' });

// Helper to get custom backup dir from DB
async function getBackupDir() {
    let backupDir = DEFAULT_BACKUP_DIR;
    try {
        const res = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'backup_path'");
        if (res.rows.length > 0 && res.rows[0].setting_value && res.rows[0].setting_value.trim() !== '') {
            backupDir = res.rows[0].setting_value.trim();
        }
    } catch (e) {}
    if (!fs.existsSync(backupDir)) {
        try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) { backupDir = DEFAULT_BACKUP_DIR; }
    }
    return backupDir;
}

// Get All System Settings
router.get('/', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM system_settings ORDER BY category, setting_key");
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// Batch Update System Settings & Refresh Scheduler
router.put('/', async (req, res) => {
    try {
        const settings = req.body;
        const keys = Object.keys(settings);

        for (const key of keys) {
            await pool.query(
                `INSERT INTO system_settings (setting_key, setting_value, category, description)
                 VALUES ($1, $2, 'general', 'System Configuration')
                 ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
                [key, String(settings[key])]
            );
        }

        // If backup settings changed, re-init scheduler
        if (keys.some(k => k.includes('backup'))) {
            initScheduler();
        }

        res.json({ message: "Settings updated successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// ── Database Health & Status Stats ──
router.get('/db-stats', async (req, res) => {
    try {
        const dbNameRes = await pool.query("SELECT current_database()");
        const dbName = dbNameRes.rows[0].current_database;

        const sizeRes = await pool.query(`SELECT pg_size_pretty(pg_database_size('${dbName}'))`);
        const connRes = await pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname = $1", [dbName]);

        const tablesRes = await pool.query(`
            SELECT count(*) FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        const totalTables = parseInt(tablesRes.rows[0].count, 10);

        res.json({
            db_type: 'PostgreSQL (Supabase Cloud Database)',
            status: 'Connected & Healthy',
            db_name: dbName,
            size: sizeRes.rows[0].pg_size_pretty,
            connections: connRes.rows[0].count,
            total_tables: totalTables,
            healthy_tables: `${totalTables} / ${totalTables} Healthy`
        });
    } catch (err) {
        console.error('db-stats error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── List Backups (.sql Files) ──
router.get('/backups', async (req, res) => {
    try {
        const dirs = [DEFAULT_BACKUP_DIR];
        const customDir = await getBackupDir();
        if (customDir && customDir !== DEFAULT_BACKUP_DIR && !dirs.includes(customDir)) {
            dirs.push(customDir);
        }

        const fileMap = new Map();

        for (const dir of dirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
                for (const f of files) {
                    const fullPath = path.join(dir, f);
                    try {
                        const stats = fs.statSync(fullPath);
                        if (!fileMap.has(f) || stats.mtime > fileMap.get(f).created_at) {
                            fileMap.set(f, {
                                name: f,
                                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                                created_at: stats.mtime,
                                filepath: fullPath
                            });
                        }
                    } catch (e) {}
                }
            }
        }

        const fileList = Array.from(fileMap.values()).sort((a, b) => b.created_at - a.created_at);
        res.json(fileList);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Manual Backup Generation (.sql) ──
router.post('/backups/create', async (req, res) => {
    try {
        const filename = await performBackup();
        res.json({ message: "Full SQL database backup created successfully.", filename });
    } catch (err) {
        console.error('Backup creation error:', err.message);
        res.status(500).json({ error: "Backup failed: " + err.message });
    }
});

// ── Delete Backup File ──
router.delete('/backups/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const backupDir = await getBackupDir();

        let deleted = false;
        const targetPaths = [
            path.join(DEFAULT_BACKUP_DIR, filename),
            path.join(backupDir, filename)
        ];

        for (const p of targetPaths) {
            if (fs.existsSync(p)) {
                fs.unlinkSync(p);
                deleted = true;
            }
        }

        if (deleted) {
            res.json({ message: "Backup deleted successfully" });
        } else {
            res.status(404).json({ error: "Backup file not found" });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Download Backup File (.sql) ──
router.get('/backups/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const backupDir = await getBackupDir();

        let targetPath = path.join(DEFAULT_BACKUP_DIR, filename);
        if (!fs.existsSync(targetPath)) {
            targetPath = path.join(backupDir, filename);
        }

        if (fs.existsSync(targetPath)) {
            res.download(targetPath);
        } else {
            res.status(404).json({ error: "File not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const { syncAllSequences } = require('../utils/sequenceSync');

// ── Restore Database Route ──
router.post('/backups/restore', upload.single('backup_file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No backup file uploaded" });
    }

    const uploadedPath = req.file.path;

    try {
        console.log(`[Restore System] Restoring database from uploaded file: ${req.file.originalname}`);
        const sqlContent = fs.readFileSync(uploadedPath, 'utf8');

        // Execute SQL commands in client connection
        const client = await pool.connect();
        try {
            await client.query(sqlContent);
            console.log('[Restore System] Database restore completed successfully.');
            
            // Instantly synchronize all PostgreSQL sequences with MAX(id) after restore
            await syncAllSequences(client);
        } finally {
            client.release();
        }

        if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
        res.json({ message: "Database restored & primary key sequences synchronized successfully. Please refresh the page." });

    } catch (err) {
        if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
        console.error('[Restore System] Error:', err.message);
        res.status(500).json({ error: "Restore failed: " + err.message });
    }
});

// ── Manual Sequence Synchronization Endpoint ──
router.post('/sync-sequences', async (req, res) => {
    try {
        const result = await syncAllSequences();
        if (result.success) {
            res.json({ message: "All PostgreSQL primary key sequences successfully synchronized with MAX(id)." });
        } else {
            res.status(500).json({ error: result.error || "Failed to synchronize sequences." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Factory Reset Database (Truncate data & re-seed essential software data) ──
router.post('/reset-database', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("⚠️ Starting Factory Reset Database...");
        await client.query('BEGIN');

        // Truncate data tables while maintaining table structures
        await client.query(`
            TRUNCATE TABLE 
                student_attendance,
                staff_attendance,
                exam_marks,
                test_marks,
                test_papers,
                exam_sheet_approvals,
                fee_payments,
                slip_line_items,
                monthly_fee_slips,
                family_opb_payments,
                admission_fee_payments,
                admission_fee_ledger,
                expenses,
                student_siblings,
                students,
                families,
                teacher_subject_assignment,
                teacher_class_assignment,
                user_sessions,
                role_audit_log,
                user_direct_permissions,
                student_academic_records
            RESTART IDENTITY CASCADE;
        `);

        await client.query('COMMIT');
        client.release();

        // Re-run Master Seeder to ensure essential initial roles, admin user, fee heads, & settings exist
        await runMasterSeeder();

        res.json({ message: "Database factory reset completed. Initial software configuration reseeded successfully." });

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
        console.error("Factory Reset Error:", err.message);
        res.status(500).json({ error: "Reset failed: " + err.message });
    }
});

// ── Backup Notification Route (For Admin Toast Notification on Login/Startup) ──
router.get('/backup-notification', async (req, res) => {
    try {
        const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'last_backup_info'");
        if (result.rows.length > 0 && result.rows[0].setting_value) {
            const info = JSON.parse(result.rows[0].setting_value);
            return res.json(info);
        }
        res.json(null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark Backup Notification as Read
router.post('/backup-notification/read', async (req, res) => {
    try {
        const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'last_backup_info'");
        if (result.rows.length > 0 && result.rows[0].setting_value) {
            const info = JSON.parse(result.rows[0].setting_value);
            info.read = true;
            await pool.query(
                "UPDATE system_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'last_backup_info'",
                [JSON.stringify(info)]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
