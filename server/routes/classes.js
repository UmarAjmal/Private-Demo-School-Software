const router = require('express').Router();
const pool = require('../db');

// ==========================================
// CLASSES API
// ==========================================

// List Classes
router.get('/', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM classes ORDER BY class_name");
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// List Classes (alternate endpoint for clarity)
router.get('/classes', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM classes ORDER BY class_name");
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// Create Class
router.post('/', async (req, res) => {
    try {
        const { class_name, description } = req.body;
        const newClass = await pool.query(
            "INSERT INTO classes (class_name, description) VALUES ($1, $2) RETURNING *",
            [class_name, description]
        );
        res.json(newClass.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// Update Class
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { class_name, description } = req.body;
        await pool.query(
            "UPDATE classes SET class_name = $1, description = $2 WHERE class_id = $3",
            [class_name, description, id]
        );
        res.json("Class updated");
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// Delete Class
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM classes WHERE class_id = $1", [id]);
        res.json("Class deleted");
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});


// ==========================================
// SECTIONS API
// ==========================================

// List Sections
router.get(['/sections', '/classes/sections'], async (req, res) => {
    try {
        // Return flat list with class info, easier to tree-ify in frontend or use JSON_AGG
        // Let's use JSON_AGG to return hierarchical structure directly? 
        // Or flat list is fine as user asked for creation UI updating.
        
        const query = `
            SELECT s.*, c.class_name 
            FROM sections s
            JOIN classes c ON s.class_id = c.class_id
            ORDER BY c.class_name, s.section_name
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Create Section
router.post('/sections', async (req, res) => {
    try {
        const { section_name, class_id } = req.body;
        const newSection = await pool.query(
            "INSERT INTO sections (section_name, class_id) VALUES ($1, $2) RETURNING *",
            [section_name, class_id]
        );
        res.json(newSection.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: "Section already exists for this class" });
        }
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Update Section
router.put('/sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { section_name, class_id } = req.body;
        await pool.query(
            "UPDATE sections SET section_name = $1, class_id = $2 WHERE section_id = $3",
            [section_name, class_id, id]
        );
        res.json("Section updated");
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Delete Section
router.delete('/sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM sections WHERE section_id = $1", [id]);
        res.json("Section deleted");
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
