const pool = require('./db');

async function seed() {
    try {
        await pool.query(`INSERT INTO system_settings (setting_key, setting_value, category, description) VALUES 
            ('auto_backup_enabled', 'false', 'backup', 'Enable automatic scheduled backups'), 
            ('backup_frequency', 'daily', 'backup', 'Frequency of backups: daily, weekly, monthly'), 
            ('backup_time', '00:00', 'backup', 'Time to run backup (HH:MM)') 
            ON CONFLICT (setting_key) DO NOTHING;`);
        console.log('Backup settings seeded');
        process.exit();
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}
seed();