const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

const DEFAULT_BACKUP_DIR = path.join(__dirname, 'backups');

// Pure Node.js Complete PostgreSQL Dump Generator
async function generatePureSqlBackup(filepath) {
    const client = await pool.connect();
    try {
        let schoolName = 'School Management System';
        try {
            const sRes = await client.query("SELECT setting_value FROM school_settings WHERE setting_key = 'school_name' UNION SELECT setting_value FROM system_settings WHERE setting_key = 'school_name'");
            if (sRes.rows.length > 0 && sRes.rows[0].setting_value) {
                schoolName = sRes.rows[0].setting_value;
            }
        } catch (e) {}

        console.log(`[Backup System] Generating full SQL database dump for ${schoolName}...`);
        let sqlDump = `-- ========================================================\n`;
        sqlDump += `-- ${schoolName.toUpperCase()} FULL DATABASE BACKUP\n`;
        sqlDump += `-- Generated At: ${new Date().toISOString()}\n`;
        sqlDump += `-- Engine: PostgreSQL\n`;
        sqlDump += `-- ========================================================\n\n`;
        sqlDump += `SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSET session_replication_role = 'replica';\n\n`;

        // 1. Sequences DDL & Values
        const seqsRes = await client.query(`
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public'
            ORDER BY sequence_name;
        `);
        for (const seq of seqsRes.rows) {
            const sName = seq.sequence_name;
            try {
                const valRes = await client.query(`SELECT last_value FROM "${sName}"`);
                if (valRes.rows.length > 0) {
                    sqlDump += `CREATE SEQUENCE IF NOT EXISTS "${sName}";\n`;
                    sqlDump += `SELECT setval('"${sName}"', ${valRes.rows[0].last_value}, true);\n\n`;
                }
            } catch (e) {}
        }

        // 2. Public Tables DDL & Data
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        const tables = tablesRes.rows.map(r => r.table_name);

        for (const table of tables) {
            // Get columns for table DDL
            const colsRes = await client.query(`
                SELECT column_name, data_type, column_default, is_nullable, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            const colDefs = colsRes.rows.map(col => {
                let typeStr = col.data_type.toUpperCase();
                if (typeStr === 'USER-DEFINED') typeStr = 'VARCHAR(255)';
                if (typeStr === 'ARRAY') typeStr = 'TEXT[]';
                if (col.character_maximum_length) typeStr += `(${col.character_maximum_length})`;
                const nullStr = col.is_nullable === 'NO' ? ' NOT NULL' : '';
                const defaultStr = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                return `"${col.column_name}" ${typeStr}${nullStr}${defaultStr}`;
            }).join(',\n    ');

            sqlDump += `-- ========================================================\n`;
            sqlDump += `-- Table structure & data for: "${table}"\n`;
            sqlDump += `-- ========================================================\n`;
            sqlDump += `CREATE TABLE IF NOT EXISTS "${table}" (\n    ${colDefs}\n);\n\n`;

            const colNames = colsRes.rows.map(c => `"${c.column_name}"`).join(', ');

            // Fetch table data
            const dataRes = await client.query(`SELECT * FROM "${table}"`);
            if (dataRes.rows.length > 0) {
                sqlDump += `-- Data for table: "${table}" (${dataRes.rows.length} rows)\n`;
                for (const row of dataRes.rows) {
                    const values = colsRes.rows.map(col => {
                        const val = row[col.column_name];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                        if (typeof val === 'number') return val;
                        if (val instanceof Date) return `'${val.toISOString()}'`;
                        if (Array.isArray(val)) {
                            const arrStr = val.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v).join(',');
                            return `'${`{${arrStr}}`}'`;
                        }
                        if (typeof val === 'object') {
                            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        }
                        return `'${String(val).replace(/'/g, "''")}'`;
                    }).join(', ');

                    sqlDump += `INSERT INTO "${table}" (${colNames}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
                }
                sqlDump += `\n`;
            }
        }

        sqlDump += `SET session_replication_role = 'origin';\n`;

        fs.writeFileSync(filepath, sqlDump, 'utf8');
        console.log(`[Backup System] Pure SQL Full Backup created cleanly at ${filepath}`);
        return true;
    } catch (err) {
        console.error('[Backup System] Error generating pure SQL dump:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Save Backup Notification State in DB
async function recordBackupNotification(filename, targetLocation, reason = 'Scheduled') {
    try {
        const payload = JSON.stringify({
            filename,
            location: targetLocation,
            timestamp: new Date().toISOString(),
            reason,
            read: false
        });

        await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, category, description)
            VALUES ('last_backup_info', $1, 'backup', 'Latest database backup metadata & notification')
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        `, [payload]);
    } catch (e) {
        console.warn("Could not save backup notification info:", e.message);
    }
}

// Function to Perform Backup
const performBackup = async (reason = 'Manual Request') => {
    let backupDir = DEFAULT_BACKUP_DIR;
    let customDir = null;

    try {
        const res = await pool.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('backup_path')");
        const pathRow = res.rows.find(r => r.setting_key === 'backup_path');
        if (pathRow && pathRow.setting_value && pathRow.setting_value.trim() !== '') {
            customDir = pathRow.setting_value.trim();
        }
    } catch (err) {
        console.warn("Failed to read backup_path setting, using default.");
    }

    // Ensure default backup dir exists
    if (!fs.existsSync(DEFAULT_BACKUP_DIR)) {
        fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
    }

    // Ensure custom dir exists if configured
    if (customDir && !fs.existsSync(customDir)) {
        try {
            fs.mkdirSync(customDir, { recursive: true });
        } catch (e) {
            console.error("Could not create custom backup dir, saving to default.", e);
            customDir = null;
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const defaultFilePath = path.join(DEFAULT_BACKUP_DIR, filename);

    try {
        // Generate pure SQL dump
        await generatePureSqlBackup(defaultFilePath);

        let finalPath = defaultFilePath;
        // Copy to custom destination directory if configured
        if (customDir && customDir !== DEFAULT_BACKUP_DIR) {
            const customFilePath = path.join(customDir, filename);
            fs.copyFileSync(defaultFilePath, customFilePath);
            finalPath = customFilePath;
            console.log(`[Backup System] Backup stored at custom location: ${customFilePath}`);
        }

        await recordBackupNotification(filename, finalPath, reason);
        return filename;
    } catch (e) {
        console.error("[Backup System] Pure SQL dump failed, attempting pg_dump fallback...", e.message);
        return new Promise((resolve, reject) => {
            let { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT, PG_DUMP_PATH } = process.env;
            const pgDumpCommand = PG_DUMP_PATH || 'pg_dump';
            const setEnv = process.platform === 'win32'
                ? `set "PGPASSWORD=${DB_PASSWORD}" &&`
                : `PGPASSWORD="${DB_PASSWORD}"`;
            const cmd = `${setEnv} "${pgDumpCommand}" -U ${DB_USER} -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -F p -f "${defaultFilePath}" ${DB_NAME}`;

            exec(cmd, async (error) => {
                if (error) {
                    return reject(error);
                }
                let finalPath = defaultFilePath;
                if (customDir && customDir !== DEFAULT_BACKUP_DIR) {
                    try {
                        finalPath = path.join(customDir, filename);
                        fs.copyFileSync(defaultFilePath, finalPath);
                    } catch (errCopy) {}
                }
                await recordBackupNotification(filename, finalPath, reason);
                resolve(filename);
            });
        });
    }
};

// Scheduler Tasks List
let activeTasks = [];

// Catch-Up Backup Check on System Startup (If system was powered off during scheduled time)
async function checkMissedBackupsOnStartup(isEnabled) {
    if (!isEnabled) return;
    try {
        const res = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'last_backup_info'");
        if (res.rows.length > 0 && res.rows[0].setting_value) {
            const info = JSON.parse(res.rows[0].setting_value);
            const lastTime = new Date(info.timestamp).getTime();
            const now = Date.now();
            const hoursDiff = (now - lastTime) / (1000 * 60 * 60);

            // If last backup was over 12 hours ago, run catch-up backup for downtime
            if (hoursDiff > 12) {
                console.log(`[Backup System] Missed scheduled backup detected (Downtime: ${hoursDiff.toFixed(1)} hours). Triggering Recovery Catch-Up Backup...`);
                await performBackup('System Startup Recovery Catch-Up');
            }
        } else {
            // First time auto backup setup
            console.log(`[Backup System] Initial Auto Backup Trigger on System Startup...`);
            await performBackup('Initial System Startup Backup');
        }
    } catch (e) {
        console.warn('[Backup System] Error checking missed backups:', e.message);
    }
}

const { createNotification } = require('./utils/notify');

/**
 * Automated Fee Reminder Notification Scheduler
 * Normal Pending: 7 notifications per day (Bilingual Urdu & English)
 * Urgent / Overdue (<=3 days or past due): 10 notifications per day (Bilingual Urdu & English)
 */
async function dispatchFeeReminderNotifications(isUrgentSlot = false) {
    try {
        console.log(`[Fee Reminder Scheduler] Running ${isUrgentSlot ? 'URGENT (10x Daily)' : 'Normal (7x Daily)'} fee reminder check...`);
        const client = await pool.connect();
        try {
            // Fetch all unpaid or partial monthly fee slips
            const res = await client.query(`
                SELECT 
                    mfs.slip_id,
                    mfs.student_id,
                    mfs.family_id,
                    mfs.month,
                    mfs.year,
                    mfs.due_date,
                    mfs.total_amount,
                    mfs.paid_amount,
                    mfs.status,
                    (mfs.total_amount - mfs.paid_amount) AS remaining_balance,
                    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                    s.family_id AS student_family_id
                FROM monthly_fee_slips mfs
                JOIN students s ON mfs.student_id = s.student_id
                WHERE mfs.status IN ('unpaid', 'partial')
                  AND (mfs.total_amount - mfs.paid_amount) > 0
                  AND s.status = 'Active'
            `);

            const today = new Date();

            for (const row of res.rows) {
                const famId = (row.family_id || row.student_family_id || '').trim();
                if (!famId) continue;

                const balance = parseFloat(row.remaining_balance || 0);
                if (balance <= 0) continue;

                const dueDate = row.due_date ? new Date(row.due_date) : null;
                let daysToDue = 999;
                if (dueDate) {
                    const diffTime = dueDate.getTime() - today.getTime();
                    daysToDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                const isUrgent = daysToDue <= 3 || daysToDue < 0; // Near due date or overdue

                // Match slot type
                if (isUrgentSlot && !isUrgent) continue;
                if (!isUrgentSlot && isUrgent) continue;

                const monthName = new Date(row.year, row.month - 1).toLocaleString('en-US', { month: 'short' });
                const formattedBalance = balance.toLocaleString('en-PK');

                let title = '';
                let message = '';

                if (isUrgent) {
                    title = `URGENT: Fee Overdue Alert | فوری: فیس کی یاد دہانی ⚠️`;
                    message = `URGENT: Due date for ${row.student_name} (${monthName} ${row.year}) is near/passed! Remaining: PKR ${formattedBalance}. Please clear immediately. فوری نوٹس: ${row.student_name} کی فیس PKR ${formattedBalance} کی آخری تاریخ قریب یا گزر چکی ہے۔ برائے مہربانی فوراً جمع کروائیں۔`;
                } else {
                    title = `Fee Reminder | فیس کی ادائیگی کی اطلاع 💳`;
                    message = `Dear Parent, fee for ${row.student_name} (${monthName} ${row.year}) is pending: PKR ${formattedBalance}. Please clear dues. محترم والدین، ${row.student_name} کی فیس PKR ${formattedBalance} واجب الادا ہے۔ برائے مہربانی بروقت فیس جمع کروائیں۔`;
                }

                await createNotification({
                    familyId: famId,
                    studentId: row.student_id,
                    type: isUrgent ? 'fee_urgent' : 'fee_reminder',
                    title,
                    message,
                    link: '/fees/collect',
                    clientOrPool: client
                });
            }

            console.log(`[Fee Reminder Scheduler] Processed fee reminders for ${res.rows.length} pending records.`);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[Fee Reminder Scheduler] Error dispatching reminders:', err.message);
    }
}

// Initialize Scheduler (Configured for 2 Times Daily Backup + Fee Reminder Schedules)
const initScheduler = async () => {
    try {
        console.log('[Backup & Reminder System] Initializing Schedulers...');

        // Stop existing tasks
        activeTasks.forEach(task => task.stop());
        activeTasks = [];

        // 1. Get Settings from DB
        const res = await pool.query("SELECT * FROM system_settings WHERE category = 'backup' OR setting_key LIKE '%backup%'");
        const settings = {};
        res.rows.forEach(r => settings[r.setting_key] = r.setting_value);

        const isEnabled = settings['auto_backup_enabled'] === 'true';

        // Check for missed backups during system downtime
        await checkMissedBackupsOnStartup(isEnabled);

        if (isEnabled) {
            // Configure 2 Daily Backup Times (Default: 08:00 AM & 08:00 PM)
            const time1 = settings['backup_time_1'] || settings['backup_time'] || '08:00';
            const time2 = settings['backup_time_2'] || '20:00';

            const times = [time1, time2].filter(Boolean);

            times.forEach(t => {
                const parts = t.split(':');
                if (parts.length === 2) {
                    const hour = parseInt(parts[0], 10);
                    const minute = parseInt(parts[1], 10);
                    if (!isNaN(hour) && !isNaN(minute)) {
                        const cronExp = `${minute} ${hour} * * *`;
                        console.log(`[Backup System] Scheduled 2-Time Daily Job set for: ${cronExp} (${t})`);
                        const task = cron.schedule(cronExp, () => {
                            console.log(`[Backup System] Triggering scheduled backup for ${t}...`);
                            performBackup(`Scheduled Daily (${t})`).catch(err => console.error('[Backup System] Scheduled backup error:', err));
                        });
                        activeTasks.push(task);
                    }
                }
            });
        }

        // 2. Configure 7x Daily Fee Reminders (Normal Pending: 8:00, 10:00, 13:00, 15:00, 18:00, 20:00, 22:00)
        const normalFeeTask = cron.schedule('0 8,10,13,15,18,20,22 * * *', () => {
            dispatchFeeReminderNotifications(false);
        });
        activeTasks.push(normalFeeTask);
        console.log('[Fee Reminder System] 7x Daily Fee Reminder schedule initialized.');

        // 3. Configure 10x Daily Urgent Fee Reminders (Overdue/Near Due: 8:00, 9:00, 11:00, 12:00, 14:00, 15:00, 17:00, 18:00, 20:00, 21:00)
        const urgentFeeTask = cron.schedule('0 8,9,11,12,14,15,17,18,20,21 * * *', () => {
            dispatchFeeReminderNotifications(true);
        });
        activeTasks.push(urgentFeeTask);
        console.log('[Fee Reminder System] 10x Daily Urgent Fee Reminder schedule initialized.');

    } catch (err) {
        console.error('[Scheduler System] Error initializing schedulers:', err.message);
    }
};

module.exports = { initScheduler, performBackup, dispatchFeeReminderNotifications };
