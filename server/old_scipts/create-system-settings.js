const pool = require('./db');

async function createSystemSettingsTable() {
    try {
        console.log("Creating/Checking 'system_settings' table...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed Default Settings if they don't exist
        const defaults = [
            // General
            { key: 'school_name', value: 'Smart School Academy', category: 'general', desc: 'Official name of the institution' },
            { key: 'contact_email', value: 'admin@smartschool.edu', category: 'general', desc: 'Primary contact email' },
            { key: 'phone_number', value: '+1-234-567-8900', category: 'general', desc: 'School phone number' },
            
            // Security
            { key: 'session_timeout_minutes', value: '30', category: 'security', desc: 'User inactivity timeout in minutes' },
            { key: 'max_login_attempts', value: '5', category: 'security', desc: 'Lock account after X failed attempts' },
            { key: 'password_min_length', value: '8', category: 'security', desc: 'Minimum allowed password length' },
            
            // Database / Maintenance
            { key: 'backup_frequency', value: 'daily', category: 'database', desc: 'Scheduled backup frequency' },
            { key: 'maintenance_mode', value: 'false', category: 'system', desc: 'Put system in read-only mode for maintenance' }
        ];

        for (const setting of defaults) {
            await pool.query(`
                INSERT INTO system_settings (setting_key, setting_value, category, description)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (setting_key) DO NOTHING
            `, [setting.key, setting.value, setting.category, setting.desc]);
        }

        console.log("System Settings table ready with defaults.");
        process.exit();

    } catch (err) {
        console.error("Error setting up system settings:", err.message);
        process.exit(1);
    }
}

createSystemSettingsTable();
