const router = require('express').Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage – save to uploads/ with unique filename to prevent browser caching
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `school_logo_${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(png|jpeg|jpg|gif|svg\+xml|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// Get Settings
router.get('/', async (req, res) => {
    try {
        const settings = await pool.query("SELECT * FROM school_settings LIMIT 1");
        if (settings.rows.length === 0) {
           return res.json({});
        }
        res.json(settings.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Update Settings
router.put('/', async (req, res) => {
    try {
        const { 
            school_name, address, contact_number, email, 
            tagline, website, logo_url, facebook_link, twitter_link, instagram_link 
        } = req.body;

        // Check if settings exist
        const check = await pool.query("SELECT * FROM school_settings LIMIT 1");

        let result;
        if (check.rows.length === 0) {
            // Insert
            result = await pool.query(
                `INSERT INTO school_settings 
                (school_name, address, contact_number, email, tagline, website, logo_url, facebook_link, twitter_link, instagram_link) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING *`,
                [school_name, address, contact_number, email, tagline, website, logo_url || null, facebook_link, twitter_link, instagram_link]
            );
        } else {
            // Update
            const existing = check.rows[0];
            const finalLogoUrl = logo_url !== undefined ? logo_url : existing.logo_url;
            result = await pool.query(
                `UPDATE school_settings 
                SET school_name = $1, address = $2, contact_number = $3, email = $4, 
                    tagline = $5, website = $6, logo_url = $7, facebook_link = $8, twitter_link = $9, instagram_link = $10
                WHERE id = $11 
                RETURNING *`,
                [school_name, address, contact_number, email, tagline, website, finalLogoUrl, facebook_link, twitter_link, instagram_link, existing.id]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Reset Database API (Danger Zone)
router.post('/reset-database', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const path = require('path');
        const resetScript = path.join(__dirname, '..', 'reset-db.js');
        
        exec(`node "${resetScript}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing reset: ${error.message}`);
                return res.status(500).json({ error: 'Failed to reset database' });
            }
            if (stderr && !stderr.includes('Created') && !stderr.includes('already exists')) {
                console.error(`Reset stderr: ${stderr}`);
            }
            console.log(`Reset stdout: ${stdout}`);
            res.json({ message: 'Database reset successfully!' });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server Error during reset' });
    }
});

// Upload School Logo (Stores Base64 Data URL directly in Postgres so Render restarts never wipe out the logo)
router.post('/logo', (req, res, next) => {
    if (req.is('json') || (req.headers['content-type'] && req.headers['content-type'].includes('application/json'))) {
        return next();
    }
    upload.single('logo')(req, res, next);
}, async (req, res) => {
    try {
        let logoUrl = '';

        if (req.body && req.body.logo_data) {
            logoUrl = req.body.logo_data;
        } else if (req.file) {
            const fileBuffer = fs.readFileSync(req.file.path);
            const base64Str = fileBuffer.toString('base64');
            logoUrl = `data:${req.file.mimetype};base64,${base64Str}`;
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        } else {
            return res.status(400).json({ error: 'No logo file or data provided' });
        }

        const check = await pool.query('SELECT id FROM school_settings LIMIT 1');
        if (check.rows.length === 0) {
            await pool.query(
                `INSERT INTO school_settings (logo_url) VALUES ($1)`,
                [logoUrl]
            );
        } else {
            await pool.query(
                `UPDATE school_settings SET logo_url = $1 WHERE id = $2`,
                [logoUrl, check.rows[0].id]
            );
        }
        res.json({ logo_url: logoUrl });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message || 'Upload failed' });
    }
});

module.exports = router;
