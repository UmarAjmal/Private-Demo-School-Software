const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

const DEFAULT_BACKUP_DIR = path.join(__dirname, 'backups');

// Function to Perform Backup
const performBackup = async () => {
    // 1. Check for custom backup path in DB Settings
    let backupDir = DEFAULT_BACKUP_DIR;
    try {
        const res = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'backup_path'");
        if (res.rows.length > 0 && res.rows[0].setting_value && res.rows[0].setting_value.trim() !== '') {
            backupDir = res.rows[0].setting_value;
        }
    } catch (err) { console.warn("Failed to read backup_path setting, using default."); }

    // Ensure dir exists
    if (!fs.existsSync(backupDir)){
        try {
            fs.mkdirSync(backupDir, { recursive: true });
        } catch (e) {
            console.error("Could not create custom backup dir, falling back to default.", e);
            backupDir = DEFAULT_BACKUP_DIR;
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
        }
    }

    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.sql`;
        const filepath = path.join(backupDir, filename);

        // Map .env variables (DB_*) to pg_dump expected variables
        let { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT, PG_DUMP_PATH } = process.env;

        // "Careful Handling": Auto-detect pg_dump if not configured
        if (!PG_DUMP_PATH) {
            const commonPaths = [
                'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
                'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
                'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
                'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
                'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
                'C:\\Program Files\\PostgreSQL\\13\\bin\\pg_dump.exe'
            ];
            for (const p of commonPaths) {
                if (fs.existsSync(p)) {
                    console.log(`[Backup System] Auto-detected pg_dump at: ${p}`);
                    PG_DUMP_PATH = p;
                    break;
                }
            }
        }

        // Use configured path or default to 'pg_dump' (requires PATH)
        const pgDumpCommand = PG_DUMP_PATH || 'pg_dump';

        // Command specific to Windows/Linux
        const setEnv = process.platform === 'win32'
            ? `set "PGPASSWORD=${DB_PASSWORD}" &&` 
            : `PGPASSWORD="${DB_PASSWORD}"`;
            
        const cmd = `${setEnv} "${pgDumpCommand}" -U ${DB_USER} -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -F p -f "${filepath}" ${DB_NAME}`;

        console.log(`[Backup System] Starting backup: ${filename}...`);

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Backup System] Error: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                // pg_dump writes to stderr for info, not always error. Log it but don't treat as fail unless error obj exists
                console.log(`[Backup System] Log: ${stderr}`);
            }
            console.log(`[Backup System] Backup completed successfully: ${filename}`);
            resolve(filename);
        });
    });
};

// Scheduler Variable
let scheduledTask = null;

// Initialize Scheduler
const initScheduler = async () => {
    try {
        console.log('[Backup System] Initializing Scheduler...');
        
        // 1. Get Settings from DB
        const res = await pool.query("SELECT * FROM system_settings WHERE category = 'backup'");
        const settings = {};
        res.rows.forEach(r => settings[r.setting_key] = r.setting_value);

        // Default if missing
        const isEnabled = settings['auto_backup_enabled'] === 'true';
        const frequency = settings['backup_frequency'] || 'daily'; // daily, weekly
        const time = settings['backup_time'] || '00:00'; // HH:MM

        // Stop existing task
        if (scheduledTask) {
            scheduledTask.stop();
            scheduledTask = null;
        }

        if (!isEnabled) {
            console.log('[Backup System] Auto backup is DISABLED.');
            return;
        }

        // Parse Cron Expression
        // Time: "14:30" -> Min: 30, Hour: 14
        const [hour, minute] = time.split(':');
        
        let cronExp = `${minute} ${hour} * * *`; // Default Daily

        if (frequency === 'weekly') {
            cronExp = `${minute} ${hour} * * 0`; // Every Sunday
        } else if (frequency === 'monthly') {
            cronExp = `${minute} ${hour} 1 * *`; // 1st of month
        }

        console.log(`[Backup System] Scheduled job set for: ${cronExp} (${frequency})`);

        scheduledTask = cron.schedule(cronExp, () => {
            console.log('[Backup System] Triggering scheduled backup...');
            performBackup().catch(err => console.error('[Backup System] Scheduled backup failed:', err));
        });

    } catch (err) {
        console.error('[Backup System] Error loading settings:', err.message);
    }
};

module.exports = { initScheduler, performBackup };
