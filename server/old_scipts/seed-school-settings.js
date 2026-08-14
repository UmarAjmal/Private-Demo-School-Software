const pool = require('./db');
async function run() {
    const inserts = [
        ['school_address', '83/M Madina Colony Vehari', 'general', 'School address'],
        ['school_phone2', '0308-7696430', 'general', 'School phone 2'],
        ['school_phone3', '067-3366383', 'general', 'School phone 3'],
        ['school_logo_url', '', 'general', 'School logo URL'],
        ['school_tagline', '', 'general', 'School tagline'],
    ];
    for (const [key, val, cat, desc] of inserts) {
        await pool.query(
            `INSERT INTO system_settings (setting_key, setting_value, category, description)
             VALUES ($1,$2,$3,$4) ON CONFLICT (setting_key) DO NOTHING`,
            [key, val, cat, desc]
        );
        console.log('Seeded:', key);
    }
    pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
