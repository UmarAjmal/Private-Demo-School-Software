const pool = require('./db');

async function createSettingsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS school_settings (
                id SERIAL PRIMARY KEY,
                school_name VARCHAR(255) DEFAULT 'Smart School',
                address TEXT,
                contact_number VARCHAR(50),
                email VARCHAR(255),
                tagline VARCHAR(255),
                website VARCHAR(255),
                logo_url VARCHAR(255),
                facebook_link VARCHAR(255),
                twitter_link VARCHAR(255),
                instagram_link VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Check if a row exists, if not insert default
        const check = await pool.query("SELECT * FROM school_settings LIMIT 1");
        if (check.rows.length === 0) {
            await pool.query(`
                INSERT INTO school_settings (school_name, tagline) 
                VALUES ('My Smart School', 'Excellence in Education')
            `);
            console.log("Default settings inserted.");
        }

        console.log("School Settings table created successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error creating settings table:", err.message);
        process.exit(1);
    }
}

createSettingsTable();
