const router = require('express').Router();
const pool = require('../db');

// Get all academic years
router.get('/years', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM academic_years ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Get years ready for promotion (configured upcoming + active)
router.get('/years/promotion-ready', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM academic_years 
            WHERE (status = 'upcoming' AND is_configured = true)
               OR status = 'active'
            ORDER BY id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Configure Year (set dates & mark configured without activating)
router.put('/years/configure/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date } = req.body;

        // Validation
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // Check if year exists and is upcoming
        const yearCheck = await pool.query(
            'SELECT id, status, year_name FROM academic_years WHERE id = $1',
            [id]
        );

        if (yearCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Academic year not found' });
        }

        if (yearCheck.rows[0].status !== 'upcoming') {
            return res.status(400).json({
                error: 'Can only configure upcoming years. This year is already ' + yearCheck.rows[0].status
            });
        }

        // Update year configuration
        const result = await pool.query(
            `UPDATE academic_years 
             SET start_date = $1, end_date = $2, is_configured = true
             WHERE id = $3 
             RETURNING *`,
            [start_date, end_date, id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Activate Year (make a configured year active)
router.put('/years/activate/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        // Check if year exists
        const yearCheck = await client.query(
            'SELECT id, is_configured, status, year_name FROM academic_years WHERE id = $1',
            [id]
        );

        if (yearCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Academic year not found' });
        }

        const year = yearCheck.rows[0];

        // Validation: Must be configured
        if (!year.is_configured) {
            return res.status(400).json({
                error: 'Year must be configured before activation. Please set dates and terms first.'
            });
        }

        // Validation: Must have terms
        const termsCheck = await client.query(
            'SELECT COUNT(*) as count FROM academic_terms WHERE academic_year_id = $1',
            [id]
        );

        if (parseInt(termsCheck.rows[0].count) === 0) {
            return res.status(400).json({
                error: 'Please configure at least one term before activating the year'
            });
        }

        // Start transaction
        await client.query('BEGIN');

        // Deactivate all active years and mark as completed
        await client.query(
            "UPDATE academic_years SET is_active = false, status = 'completed' WHERE is_active = true"
        );

        // Activate selected year
        await client.query(
            "UPDATE academic_years SET is_active = true, status = 'active' WHERE id = $1",
            [id]
        );

        await client.query('COMMIT');

        // Fetch updated year
        const result = await client.query(
            'SELECT * FROM academic_years WHERE id = $1',
            [id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Server Error' });
    } finally {
        client.release();
    }
});

// Get Terms for a Year
router.get('/terms/:yearId', async (req, res) => {
    try {
        const { yearId } = req.params;
        const result = await pool.query("SELECT * FROM academic_terms WHERE academic_year_id = $1 ORDER BY id ASC", [yearId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Add/Update Terms for a Year
router.post('/terms', async (req, res) => {
    // Bug 5 Fix: use a transaction so partial failures don't corrupt terms
    const client = await pool.connect();
    try {
        const { academic_year_id, terms } = req.body;

        if (!academic_year_id || !Array.isArray(terms)) {
            return res.status(400).json({ error: "Invalid request data. academic_year_id and terms array are required." });
        }

        // 1. Check if year is completed (outside transaction read-only check)
        const yearCheck = await client.query("SELECT status FROM academic_years WHERE id = $1", [academic_year_id]);
        if (yearCheck.rows.length === 0) return res.status(404).json({ error: 'Year not found' });

        if (yearCheck.rows[0].status === 'completed') {
            return res.status(403).json({ error: "Cannot modify terms for a completed academic year." });
        }

        await client.query('BEGIN');

        // Delete existing terms for this year
        await client.query("DELETE FROM academic_terms WHERE academic_year_id = $1", [academic_year_id]);

        // Insert new terms
        const insertedTerms = [];
        for (const term of terms) {
            const newTerm = await client.query(
                "INSERT INTO academic_terms (academic_year_id, term_name, has_summer_work, has_winter_work) VALUES ($1, $2, $3, $4) RETURNING *",
                [academic_year_id, term.term_name, term.has_summer_work || false, term.has_winter_work || false]
            );
            insertedTerms.push(newTerm.rows[0]);
        }

        await client.query('COMMIT');
        res.json(insertedTerms);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Server Error' });
    } finally {
        client.release();
    }
});

module.exports = router;
