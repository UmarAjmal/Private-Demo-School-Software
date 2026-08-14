const express = require('express');
const router = require('express').Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs'); // Added for Password Hashing

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/students';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit per file
});

// ==========================================
// FAMILY & SIBLING MANAGEMENT
// ==========================================

// Helper function to generate Family ID
async function generateFamilyId(client) {
    const year = new Date().getFullYear();
    const lastFamily = await client.query(`
        SELECT family_id FROM students 
        WHERE family_id LIKE $1 
        ORDER BY family_id DESC LIMIT 1
    `, [`FAM-${year}-%`]);

    let familyNum = 1;
    if (lastFamily.rows.length > 0) {
        const lastId = lastFamily.rows[0].family_id;
        const match = lastId.match(/FAM-\d{4}-(\d{4})/);
        if (match) {
            familyNum = parseInt(match[1]) + 1;
        }
    }

    return `FAM-${year}-${String(familyNum).padStart(4, '0')}`;
}

// Search for potential siblings
router.get('/search-siblings', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim().length < 2) {
            return res.json([]);
        }

        // Split query by commas to allow searching by name, class, and section together (e.g. "Ali, class 2, section A")
        const terms = query.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const params = [];
        const conditions = [];

        terms.forEach((term, idx) => {
            const temp = `$${idx + 1}`;
            params.push(`%${term}%`);
            conditions.push(`(
                s.first_name ILIKE ${temp} OR
                s.last_name ILIKE ${temp} OR
                s.admission_no ILIKE ${temp} OR
                s.father_name ILIKE ${temp} OR
                CONCAT(s.first_name, ' ', s.last_name) ILIKE ${temp} OR
                c.class_name ILIKE ${temp} OR
                sec.section_name ILIKE ${temp}
            )`);
        });

        const whereLogic = conditions.length > 0 ? `AND ( ${conditions.join(' AND ')} )` : '';

        const result = await pool.query(`
            SELECT
                s.student_id,
                s.admission_no,
                s.first_name,
                s.last_name,
                s.father_name,
                s.father_phone,
                s.father_cnic,
                s.father_occupation,
                s.mother_name,
                s.mother_phone,
                s.mother_cnic,
                s.mother_occupation,
                s.gender,
                s.dob,
                s.family_id,
                s.monthly_fee,
                s.class_id,
                s.image_url,
                s.current_address,
                s.permanent_address,
                s.city,
                s.guardian_name,
                s.guardian_relation,
                s.guardian_phone,
                s.guardian_cnic,
                s.guardian_address,
                c.class_name,
                sec.section_name,
                COALESCE(f.family_fee, 0) AS family_fee,
                (SELECT COUNT(*) FROM students s2 WHERE s2.family_id = s.family_id AND s2.status = 'Active') AS family_size
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            LEFT JOIN families f ON f.family_id = s.family_id
            WHERE
                s.status = 'Active' ${whereLogic}
            ORDER BY s.admission_date DESC
            LIMIT 20
        `, params);

        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get siblings of a student
router.get('/:id/siblings', async (req, res) => {
    try {
        const { id } = req.params;

        // Get student's family_id
        const student = await pool.query(`
            SELECT family_id FROM students WHERE student_id = $1
        `, [id]);

        if (student.rows.length === 0) {
            return res.status(404).json({ error: "Student not found" });
        }

        const familyId = student.rows[0].family_id;

        if (!familyId) {
            return res.json([]);
        }

        // Get all students with same family_id and their relation_type.
        //
        // STRATEGY (3-level COALESCE):
        //   1. Forward row in student_siblings  (A → B): most authoritative
        //   2. Reverse row in student_siblings  (B → A): handles asymmetric old data
        //   3. Father-name comparison (SMART FALLBACK):
        //        • Same father_name  → 'blood'   (they are real siblings)
        //        • Different father_name → 'cousin' (different dads = cousins in same family)
        //      This correctly handles bulk-imported families and merged families where
        //      cousins share a family_id but have different fathers.
        //
        // We use correlated subqueries (not a LEFT JOIN with OR) to avoid duplicate rows.

        // First: fetch the current student's father_name for the comparison
        const currentStudentRes = await pool.query(
            `SELECT father_name FROM students WHERE student_id = $1`, [id]
        );
        const currentFatherName = (currentStudentRes.rows[0]?.father_name || '').trim().toLowerCase().replace(/\s+/g, ' ');

        const siblings = await pool.query(`
            SELECT 
                s.student_id,
                s.admission_no,
                s.first_name,
                s.last_name,
                s.father_name,
                s.mother_name,
                s.gender,
                s.dob,
                s.family_id,
                s.sibling_relation,
                s.class_id,
                s.image_url,
                c.class_name,
                sec.section_name,
                COALESCE(
                    -- Level 1: Forward direction (current student → this sibling)
                    (
                        SELECT ss.relation_type 
                        FROM student_siblings ss
                        WHERE ss.student_id = $1 AND ss.sibling_id = s.student_id
                        LIMIT 1
                    ),
                    -- Level 2: Reverse direction (this sibling → current student)
                    (
                        SELECT ss.relation_type 
                        FROM student_siblings ss
                        WHERE ss.student_id = s.student_id AND ss.sibling_id = $1
                        LIMIT 1
                    ),
                    -- Level 3: Father-name smart fallback
                    --   Same father → blood sibling
                    --   Different father → cousin
                    CASE
                        WHEN $3 = '' THEN 'blood'
                        WHEN LOWER(TRIM(REGEXP_REPLACE(s.father_name, '\s+', ' ', 'g'))) = $3
                            THEN 'blood'
                        ELSE 'cousin'
                    END
                ) AS relation_type
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            WHERE s.family_id = $2 AND s.student_id != $1
            ORDER BY s.dob ASC
        `, [id, familyId, currentFatherName]);

        res.json(siblings.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// ==========================================
// DATA REPAIR: Fix corrupted relation_types
// ==========================================
// This endpoint corrects entries that were wrongly set to 'blood' by the
// faulty DO UPDATE migration. It resets student_siblings rows to 'cousin'
// where the two students have DIFFERENT father_names (i.e., they are not
// true blood siblings - their shared family_id is due to a merge).
// Safe to call repeatedly (idempotent).
router.post('/repair-sibling-relations', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find all student_siblings rows marked 'blood' where the two students
        // have different father names. These were incorrectly set by the bad migration.
        // They should be 'cousin' because blood siblings must share the same father.
        const repairResult = await client.query(`
            UPDATE student_siblings ss
            SET relation_type = 'cousin'
            FROM students a, students b
            WHERE ss.student_id = a.student_id
              AND ss.sibling_id = b.student_id
              AND ss.relation_type = 'blood'
              AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') != ''
              AND COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '') != ''
              AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') 
                  != COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '')
        `);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Repaired ${repairResult.rowCount} incorrectly marked sibling relationships`,
            rowsFixed: repairResult.rowCount
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Repair error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// DATA REPAIR: Backfill missing sibling rows
// ==========================================
// For every pair of students sharing the same family_id that has NO row in
// student_siblings, insert the correct relation_type based on father_name:
//   • Same father_name  → 'blood'  (real siblings)
//   • Different father_name → 'cousin' (different fathers in merged family)
// Safe to call repeatedly (idempotent DO NOTHING on conflict).
router.post('/repair-missing-blood-rows', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find all (a, b) pairs in the same family that have NO student_siblings row.
        // Use father_name comparison to assign the correct relation_type.
        const repairResult = await client.query(`
            INSERT INTO student_siblings (student_id, sibling_id, relation_type)
            SELECT
                a.student_id,
                b.student_id,
                CASE
                    WHEN LOWER(TRIM(REGEXP_REPLACE(COALESCE(a.father_name,''), '\\s+', ' ', 'g')))
                       = LOWER(TRIM(REGEXP_REPLACE(COALESCE(b.father_name,''), '\\s+', ' ', 'g')))
                       AND COALESCE(TRIM(a.father_name), '') != ''
                        THEN 'blood'
                    ELSE 'cousin'
                END AS relation_type
            FROM students a
            JOIN students b ON a.family_id = b.family_id
              AND a.student_id != b.student_id
              AND a.family_id IS NOT NULL
            WHERE NOT EXISTS (
                SELECT 1 FROM student_siblings ss
                WHERE ss.student_id = a.student_id
                  AND ss.sibling_id = b.student_id
            )
            ON CONFLICT (student_id, sibling_id) DO NOTHING
        `);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Backfilled ${repairResult.rowCount} missing sibling rows (with father-name based relation_type)`,
            rowsInserted: repairResult.rowCount
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Backfill repair error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// PHASE 2 & 3: FAMILY MANAGEMENT ENDPOINTS
// ==========================================

// Get Potential Duplicate Families (Phase 2)
router.get('/families/potential-duplicates', async (req, res) => {
    try {
        const query = `
            WITH family_details AS (
                SELECT 
                    family_id,
                    ARRAY_AGG(student_id ORDER BY created_at) as student_ids,
                    ARRAY_AGG(first_name || ' ' || last_name ORDER BY created_at) as student_names,
                    ARRAY_AGG(admission_no ORDER BY created_at) as admission_nos,
                    ARRAY_AGG(class_name ORDER BY created_at) as classes,
                    MAX(father_name) as father_name,
                    MAX(father_phone) as father_phone,
                    MAX(father_cnic) as father_cnic,
                    MAX(permanent_address) as address,
                    COUNT(*) as family_size
                FROM students s
                LEFT JOIN classes c ON s.class_id = c.class_id
                WHERE s.family_id IS NOT NULL
                GROUP BY family_id
            )
            SELECT 
                f1.family_id as family1_id,
                f1.student_ids as family1_student_ids,
                f1.student_names as family1_students,
                f1.admission_nos as family1_admission_nos,
                f1.classes as family1_classes,
                f1.father_name as father1_name,
                f1.father_phone as father1_phone,
                f1.father_cnic as father1_cnic,
                f1.address as address1,
                f1.family_size as family1_size,
                
                f2.family_id as family2_id,
                f2.student_ids as family2_student_ids,
                f2.student_names as family2_students,
                f2.admission_nos as family2_admission_nos,
                f2.classes as family2_classes,
                f2.father_name as father2_name,
                f2.father_phone as father2_phone,
                f2.father_cnic as father2_cnic,
                f2.address as address2,
                f2.family_size as family2_size,
                
                CASE
                    WHEN LOWER(f1.father_name) = LOWER(f2.father_name) 
                         AND f1.father_phone = f2.father_phone THEN 95
                    WHEN LOWER(f1.father_name) = LOWER(f2.father_name)
                         AND RIGHT(f1.father_phone, 7) = RIGHT(f2.father_phone, 7) THEN 85
                    WHEN f1.father_phone = f2.father_phone THEN 75
                    ELSE 60
                END as match_score
                
            FROM family_details f1
            JOIN family_details f2 ON f1.family_id < f2.family_id
            WHERE (
                (LOWER(f1.father_name) = LOWER(f2.father_name) 
                 AND (f1.father_phone = f2.father_phone 
                      OR RIGHT(f1.father_phone, 7) = RIGHT(f2.father_phone, 7)))
                OR f1.father_phone = f2.father_phone
            )
            AND f1.family_id != f2.family_id
            ORDER BY match_score DESC, f1.family_id
            LIMIT 50
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error('Duplicate detection error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Merge Two Families (Phase 2)
router.post('/families/merge', async (req, res) => {
    const client = await pool.connect();
    try {
        const { primaryFamilyId, secondaryFamilyId, relationType } = req.body;

        if (!primaryFamilyId || !secondaryFamilyId || !relationType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Get all students from both families
        const family1 = await client.query(
            'SELECT student_id FROM students WHERE family_id = $1',
            [primaryFamilyId]
        );
        const family2 = await client.query(
            'SELECT student_id FROM students WHERE family_id = $1',
            [secondaryFamilyId]
        );

        if (family2.rows.length === 0) {
            throw new Error('Secondary family not found');
        }

        // Move all secondary family members to primary family.
        // Do NOT overwrite sibling_relation blood siblings among themselves must stay 'blood'.
        await client.query(
            `UPDATE students SET family_id = $1 WHERE family_id = $2`,
            [primaryFamilyId, secondaryFamilyId]
        );

        // STEP A: Ensure all intra-primary-family blood rows exist in student_siblings.
        for (let i = 0; i < family1.rows.length; i++) {
            for (let j = i + 1; j < family1.rows.length; j++) {
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, 'blood'), ($2, $1, 'blood')
                     ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                    [family1.rows[i].student_id, family1.rows[j].student_id]
                );
            }
        }

        // STEP B: Ensure all intra-secondary-family blood rows exist in student_siblings.
        for (let i = 0; i < family2.rows.length; i++) {
            for (let j = i + 1; j < family2.rows.length; j++) {
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, 'blood'), ($2, $1, 'blood')
                     ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                    [family2.rows[i].student_id, family2.rows[j].student_id]
                );
            }
        }

        // STEP C: Create cross-family sibling relationships with the user-specified relationType.
        // Use DO UPDATE to overwrite any stale/incorrect relation_type values.
        for (let i = 0; i < family1.rows.length; i++) {
            for (let j = 0; j < family2.rows.length; j++) {
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, $3), ($2, $1, $3)
                     ON CONFLICT (student_id, sibling_id)
                     DO UPDATE SET relation_type = EXCLUDED.relation_type`,
                    [family1.rows[i].student_id, family2.rows[j].student_id, relationType]
                );
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Merged ${family2.rows.length} students into ${primaryFamilyId}`,
            mergedFamily: primaryFamilyId,
            movedStudents: family2.rows.length
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Merge error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Search Students for Manual Linking (Phase 3)
router.get('/families/search-for-link', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.json([]);
        }

        const result = await pool.query(`
            SELECT 
                s.student_id,
                s.admission_no,
                s.first_name,
                s.last_name,
                s.father_name,
                s.family_id,
                c.class_name,
                sec.section_name,
                s.image_url
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            WHERE LOWER(s.first_name || ' ' || s.last_name) LIKE LOWER($1)
               OR s.admission_no LIKE $1
               OR LOWER(s.father_name) LIKE LOWER($1)
            ORDER BY s.first_name
            LIMIT 20
        `, [`%${query}%`]);

        res.json(result.rows);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Manual Link Between Two Students (Phase 3)
router.post('/families/manual-link', async (req, res) => {
    const client = await pool.connect();
    try {
        const { student1_id, student2_id, relation_type } = req.body;

        if (!student1_id || !student2_id || !relation_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (student1_id === student2_id) {
            return res.status(400).json({ error: 'Cannot link a student to themselves' });
        }

        await client.query('BEGIN');

        // Get both students' info
        const students = await client.query(
            `SELECT student_id, family_id, first_name, last_name 
             FROM students 
             WHERE student_id IN ($1, $2)`,
            [student1_id, student2_id]
        );

        if (students.rows.length !== 2) {
            throw new Error('One or both students not found');
        }

        const [s1, s2] = students.rows;

        // If already in same family, just create/update relationship
        if (s1.family_id === s2.family_id) {
            await client.query(
                `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                 VALUES ($1, $2, $3), ($2, $1, $3)
                 ON CONFLICT (student_id, sibling_id) 
                 DO UPDATE SET relation_type = $3`,
                [student1_id, student2_id, relation_type]
            );

            await client.query('COMMIT');
            return res.json({
                success: true,
                message: 'Sibling relationship created',
                action: 'relationship_only'
            });
        }

        // Different families - Merge them
        const primaryFamilyId = s1.family_id < s2.family_id ? s1.family_id : s2.family_id;
        const secondaryFamilyId = s1.family_id < s2.family_id ? s2.family_id : s1.family_id;

        // Get all students from primary family before update
        const primaryFamilyStudents = await client.query(
            'SELECT student_id FROM students WHERE family_id = $1',
            [primaryFamilyId]
        );

        // Get all students from secondary family before update
        const secondaryFamilyStudents = await client.query(
            'SELECT student_id FROM students WHERE family_id = $1',
            [secondaryFamilyId]
        );

        // Move all secondary family members to primary family.
        // We do NOT touch sibling_relation here blood siblings within each original
        // family must keep their 'blood' status among themselves.
        await client.query(
            `UPDATE students SET family_id = $1 WHERE family_id = $2`,
            [primaryFamilyId, secondaryFamilyId]
        );

        // STEP A: Ensure all intra-primary-family blood rows exist in student_siblings.
        // This guarantees blood siblings always have explicit rows (idempotent DO NOTHING).
        for (let i = 0; i < primaryFamilyStudents.rows.length; i++) {
            for (let j = i + 1; j < primaryFamilyStudents.rows.length; j++) {
                const pA = primaryFamilyStudents.rows[i].student_id;
                const pB = primaryFamilyStudents.rows[j].student_id;
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, 'blood'), ($2, $1, 'blood')
                     ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                    [pA, pB]
                );
            }
        }

        // STEP B: Ensure all intra-secondary-family blood rows exist in student_siblings.
        for (let i = 0; i < secondaryFamilyStudents.rows.length; i++) {
            for (let j = i + 1; j < secondaryFamilyStudents.rows.length; j++) {
                const sA = secondaryFamilyStudents.rows[i].student_id;
                const sB = secondaryFamilyStudents.rows[j].student_id;
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, 'blood'), ($2, $1, 'blood')
                     ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                    [sA, sB]
                );
            }
        }

        // STEP C: Create cross-family sibling relationships.
        // For the directly-linked pair: use the specified relation_type.
        // For all other cross-family pairs: use 'cousin'.
        // Use DO UPDATE to overwrite any stale/incorrect relation_type values.
        for (let i = 0; i < primaryFamilyStudents.rows.length; i++) {
            for (let j = 0; j < secondaryFamilyStudents.rows.length; j++) {
                const pId = primaryFamilyStudents.rows[i].student_id;
                const sId = secondaryFamilyStudents.rows[j].student_id;

                const pairRelation = (
                    (pId === student1_id && sId === student2_id) ||
                    (pId === student2_id && sId === student1_id)
                ) ? relation_type : 'cousin';

                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, $3), ($2, $1, $3)
                     ON CONFLICT (student_id, sibling_id)
                     DO UPDATE SET relation_type = EXCLUDED.relation_type`,
                    [pId, sId, pairRelation]
                );
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Linked ${s2.first_name} to ${s1.first_name}'s family as ${relation_type}`,
            primaryFamily: primaryFamilyId,
            movedStudents: secondaryFamilyStudents.rows.length,
            action: 'family_merged'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Manual link error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// GET /students/families-directory list all families with children, classes, sections, parents info
router.get('/families-directory', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.student_id,
                s.family_id,
                s.admission_no,
                s.first_name,
                s.last_name,
                s.father_name,
                s.father_phone,
                s.father_cnic,
                s.father_occupation,
                s.mother_name,
                s.mother_phone,
                s.mother_cnic,
                s.mother_occupation,
                s.guardian_name,
                s.guardian_phone,
                s.guardian_relation,
                s.current_address,
                s.gender,
                s.dob,
                s.status,
                c.class_id,
                c.class_name,
                sec.section_id,
                sec.section_name,
                f.family_fee,
                f.opening_balance
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            LEFT JOIN families f ON s.family_id = f.family_id
            WHERE s.family_id IS NOT NULL AND TRIM(s.family_id) != ''
            ORDER BY s.family_id, c.class_id DESC NULLS LAST, s.first_name
        `);

        const familiesMap = {};

        for (const s of result.rows) {
            const fid = s.family_id.trim();
            if (!familiesMap[fid]) {
                familiesMap[fid] = {
                    family_id: fid,
                    family_fee: parseFloat(s.family_fee || 0),
                    opening_balance: parseFloat(s.opening_balance || 0),
                    members: []
                };
            }
            familiesMap[fid].members.push({
                student_id: s.student_id,
                admission_no: s.admission_no,
                first_name: s.first_name || '',
                last_name: s.last_name || '',
                full_name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
                father_name: (s.father_name || '').trim(),
                father_phone: (s.father_phone || '').trim(),
                father_cnic: (s.father_cnic || '').trim(),
                mother_name: (s.mother_name || '').trim(),
                mother_phone: (s.mother_phone || '').trim(),
                mother_cnic: (s.mother_cnic || '').trim(),
                guardian_name: (s.guardian_name || '').trim(),
                guardian_phone: (s.guardian_phone || '').trim(),
                current_address: (s.current_address || '').trim(),
                class_id: s.class_id,
                class_name: s.class_name || 'N/A',
                section_id: s.section_id,
                section_name: s.section_name || 'N/A',
                status: s.status || 'Active'
            });
        }

        // Query overall fee statistics per family across all generated monthly fee slips
        const feeStatsRes = await pool.query(`
            SELECT 
                f.family_id,
                COALESCE(SUM(ms.total_amount), 0) + COALESCE(f.opening_balance, 0) AS total_billed,
                COALESCE(SUM(ms.paid_amount), 0) AS total_paid,
                GREATEST(0, (COALESCE(SUM(ms.total_amount), 0) + COALESCE(f.opening_balance, 0)) - COALESCE(SUM(ms.paid_amount), 0)) AS total_balance
            FROM families f
            LEFT JOIN monthly_fee_slips ms ON (ms.family_id = f.family_id OR ms.student_id IN (SELECT student_id FROM students WHERE family_id = f.family_id))
            GROUP BY f.family_id, f.opening_balance
        `);

        const feeStatsMap = {};
        for (const r of feeStatsRes.rows) {
            const fid = (r.family_id || '').trim();
            const billed = parseFloat(r.total_billed || 0);
            const paid = parseFloat(r.total_paid || 0);
            const balance = parseFloat(r.total_balance || 0);
            let status = 'paid';
            if (balance > 0 && paid > 0) {
                status = 'partial';
            } else if (balance > 0) {
                status = 'unpaid';
            }
            feeStatsMap[fid] = {
                total_billed: billed,
                total_paid: paid,
                total_balance: balance,
                fee_status: status
            };
        }

        const familiesList = Object.values(familiesMap).map(fam => {
            const members = fam.members;

            // Majority Father Name logic:
            const fatherCounts = {};
            members.forEach(m => {
                if (m.father_name) {
                    fatherCounts[m.father_name] = (fatherCounts[m.father_name] || 0) + 1;
                }
            });

            let primaryFatherName = '';
            let maxCount = 0;
            for (const [fn, count] of Object.entries(fatherCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    primaryFatherName = fn;
                }
            }

            if (!primaryFatherName) {
                primaryFatherName = members.find(m => m.father_name)?.father_name ||
                    members.find(m => m.guardian_name)?.guardian_name ||
                    `Family (${fam.family_id})`;
            }

            // Majority Mother Name
            const motherCounts = {};
            members.forEach(m => {
                if (m.mother_name) {
                    motherCounts[m.mother_name] = (motherCounts[m.mother_name] || 0) + 1;
                }
            });
            let primaryMotherName = '';
            let maxMCount = 0;
            for (const [mn, count] of Object.entries(motherCounts)) {
                if (count > maxMCount) {
                    maxMCount = count;
                    primaryMotherName = mn;
                }
            }
            if (!primaryMotherName) {
                primaryMotherName = members.find(m => m.mother_name)?.mother_name || '—';
            }

            // Contact Phones
            const fatherPhone = members.find(m => m.father_phone)?.father_phone || '';
            const motherPhone = members.find(m => m.mother_phone)?.mother_phone || '';
            const guardianPhone = members.find(m => m.guardian_phone)?.guardian_phone || '';
            const primaryPhone = fatherPhone || motherPhone || guardianPhone || '';

            // Children list, Classes, Sections
            const childrenNames = members.map(m => m.full_name);
            const classesList = members.map(m => m.class_name);
            const sectionsList = members.map(m => m.section_name);

            const feeStat = feeStatsMap[fam.family_id] || { total_billed: 0, total_paid: 0, total_balance: 0, fee_status: 'paid' };

            return {
                family_id: fam.family_id,
                family_name: primaryFatherName,
                father_name: primaryFatherName,
                mother_name: primaryMotherName,
                father_phone: fatherPhone,
                mother_phone: motherPhone,
                guardian_phone: guardianPhone,
                primary_phone: primaryPhone,
                total_children: members.length,
                children_names: childrenNames,
                classes_list: classesList,
                sections_list: sectionsList,
                family_fee: fam.family_fee,
                opening_balance: fam.opening_balance,
                total_billed: feeStat.total_billed,
                total_paid: feeStat.total_paid,
                total_balance: feeStat.total_balance,
                fee_status: feeStat.fee_status,
                members: members
            };
        });

        // Sequence Sort: Unpaid (1) -> Partial (2) -> Paid (3)
        const statusPriority = { unpaid: 1, partial: 2, paid: 3 };

        familiesList.sort((a, b) => {
            const pA = statusPriority[a.fee_status] || 3;
            const pB = statusPriority[b.fee_status] || 3;
            if (pA !== pB) return pA - pB;
            return a.family_id.localeCompare(b.family_id, undefined, { numeric: true });
        });

        const totalStudents = result.rows.length;
        const totalFamilies = familiesList.length;

        res.json({
            families: familiesList,
            stats: {
                total_families: totalFamilies,
                total_students: totalStudents,
                average_family_size: totalFamilies > 0 ? (totalStudents / totalFamilies).toFixed(1) : 0
            }
        });
    } catch (err) {
        console.error('Error fetching families directory:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /students/families/:family_id get family info including family_fee and members
router.get('/families/:family_id', async (req, res) => {
    try {
        const { family_id } = req.params;
        // Get family record (upsert if missing)
        let familyResult = await pool.query(
            `SELECT * FROM families WHERE family_id = $1`, [family_id]
        );
        if (familyResult.rows.length === 0) {
            // Create a stub record for this family_id
            await pool.query(
                `INSERT INTO families (family_id, family_fee) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [family_id]
            );
            familyResult = await pool.query(`SELECT * FROM families WHERE family_id = $1`, [family_id]);
        }
        // Get all members
        const members = await pool.query(`
            SELECT s.student_id, s.admission_no, s.first_name, s.last_name,
                   s.monthly_fee, c.class_name, s.status
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            WHERE s.family_id = $1 AND s.status = 'Active'
            ORDER BY c.class_id DESC NULLS LAST, s.first_name
        `, [family_id]);
        res.json({
            ...familyResult.rows[0],
            members: members.rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /students/families/:family_id/fee update family fee
router.put('/families/:family_id/fee', async (req, res) => {
    try {
        const { family_id } = req.params;
        const { family_fee } = req.body;
        if (family_fee === undefined || family_fee === null || isNaN(parseFloat(family_fee))) {
            return res.status(400).json({ error: 'family_fee is required and must be a number' });
        }
        // Upsert families record
        const result = await pool.query(`
            INSERT INTO families (family_id, family_fee)
            VALUES ($1, $2)
            ON CONFLICT (family_id) DO UPDATE SET family_fee = EXCLUDED.family_fee
            RETURNING *
        `, [family_id, parseFloat(family_fee)]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// STUDENT MANAGEMENT API
// ==========================================

// 1. New Admission (Single Student)
router.post('/', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'documents', maxCount: 5 }]), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            // Academic
            roll_no, class_id, section_id, admission_date, category,
            // Personal
            first_name, last_name, gender, dob, cnic_bform,
            religion, blood_group, has_disability, disability_details,
            // Contact
            mobile_no, email, current_address, permanent_address, city,
            // Parents
            father_name, father_phone, father_cnic, father_occupation,
            mother_name, mother_phone, mother_cnic, mother_occupation,
            // Guardian
            is_orphan, guardian_name, guardian_relation, guardian_phone, guardian_cnic, guardian_address,
            // Fees
            monthly_fee, admission_fee, other_charges,
            // Family fee (applies to the whole family unit)
            family_fee,
            // Opening Balance (previous dues before software was installed)
            opening_balance,
            // Family & Sibling - UPDATED for multiple siblings
            siblings // JSON array: [{sibling_id, relation_type}, ...]
        } = req.body;

        // Handle Files
        let image_url = null;
        if (req.files['image'] && req.files['image'][0]) {
            image_url = req.files['image'][0].path.replace(/\\/g, "/"); // Normalize path
        }

        let documents = [];
        if (req.files['documents']) {
            documents = req.files['documents'].map(f => f.path.replace(/\\/g, "/"));
        }

        await client.query('BEGIN');

        // Automatically sync PostgreSQL primary key sequences to prevent duplicate ID collisions
        const { syncAllSequences } = require('../utils/sequenceSync');
        await syncAllSequences(client);

        const dateObj = admission_date ? new Date(admission_date) : new Date();
        const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const day = String(dateObj.getDate()).padStart(2, '0');
        const year = dateObj.getFullYear();

        // Format: MMMDDYYYY (e.g., FEB052026)
        const prefix = `${month}${day}${year}`;

        // Find latest admission number with this prefix
        const lastStudent = await client.query(
            "SELECT admission_no FROM students WHERE admission_no LIKE $1 ORDER BY admission_no DESC LIMIT 1",
            [`${prefix}%`]
        );

        let sequence = '001';
        if (lastStudent.rows.length > 0) {
            const lastAdm = lastStudent.rows[0].admission_no;
            const lastSeq = parseInt(lastAdm.replace(prefix, ''));
            if (!isNaN(lastSeq)) {
                sequence = String(lastSeq + 1).padStart(3, '0');
            }
        }

        const auto_admission_no = `${prefix}${sequence}`;

        // ----------------------------------------------------
        // FAMILY ID & SIBLING HANDLING (Multiple Siblings Support)
        // ----------------------------------------------------
        let family_id = null;
        let siblingsArray = [];

        // Parse siblings JSON if provided
        if (siblings) {
            try {
                siblingsArray = typeof siblings === 'string' ? JSON.parse(siblings) : siblings;
            } catch (err) {
                console.error('Error parsing siblings JSON:', err);
                siblingsArray = [];
            }
        }

        // If student has siblings, get/assign family_id
        if (siblingsArray.length > 0) {
            // Get family_id from first sibling
            const firstSiblingId = siblingsArray[0].sibling_id;
            const siblingResult = await client.query(
                `SELECT family_id FROM students WHERE student_id = $1`,
                [firstSiblingId]
            );

            if (siblingResult.rows.length > 0) {
                family_id = siblingResult.rows[0].family_id;

                // If sibling doesn't have family_id, generate one and update all siblings
                if (!family_id) {
                    family_id = await generateFamilyId(client);
                    // Update all siblings with the new family_id
                    for (const sib of siblingsArray) {
                        await client.query(
                            `UPDATE students SET family_id = $1 WHERE student_id = $2`,
                            [family_id, sib.sibling_id]
                        );
                    }
                }
            }
        }

        // If no siblings or sibling not found, generate new family_id
        if (!family_id) {
            family_id = await generateFamilyId(client);
        }

        // -------------------------------------------------------
        // UPSERT INTO families TABLE (ensure record always exists)
        // If family_fee is provided, update it. Otherwise keep existing.
        // If opening_balance is provided, set it on the family.
        // -------------------------------------------------------
        const familyFeeVal = parseFloat(family_fee) || 0;
        const opbVal = parseFloat(opening_balance) || 0;
        await client.query(`
            INSERT INTO families (family_id, family_fee, opening_balance, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (family_id) DO UPDATE
                SET family_fee = CASE 
                    WHEN $2 > 0 THEN $2 
                    ELSE families.family_fee 
                END,
                opening_balance = CASE
                    WHEN $3 > 0 THEN $3
                    ELSE families.opening_balance
                END
        `, [family_id, familyFeeVal, opbVal]);

        // Determine primary sibling_relation for the student record
        // Use 'blood' if any sibling is blood relation, otherwise 'cousin'
        let final_sibling_relation = null;
        if (siblingsArray.length > 0) {
            const hasBloodSibling = siblingsArray.some(s => s.relation_type === 'blood');
            final_sibling_relation = hasBloodSibling ? 'blood' : 'cousin';
        }

        // ----------------------------------------------------
        // USER CREDENTIALS GENERATION
        // ----------------------------------------------------
        let username = `STU-${auto_admission_no}`;

        let uIdx = 1;
        let isUnique = false;
        while (!isUnique) {
            const uCheck = await client.query('SELECT id FROM app_users WHERE username = $1', [username]);
            if (uCheck.rows.length === 0) {
                isUnique = true;
            } else {
                username = `STU-${auto_admission_no}-${uIdx}`;
                uIdx++;
            }
        }

        // Default Password: 'student123' (Hashed)
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash('student123', salt);

        // Get Role ID for 'Student'
        let roleRes = await client.query("SELECT id FROM app_roles WHERE role_name = 'Student'");
        let role_id;
        if (roleRes.rows.length === 0) {
            const newRole = await client.query("INSERT INTO app_roles (role_name, description) VALUES ('Student', 'Standard Student Access') RETURNING id");
            role_id = newRole.rows[0].id;
        } else {
            role_id = roleRes.rows[0].id;
        }

        // Create User
        const newUser = await client.query(
            `INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
            [username, password_hash, 'student123', `${first_name} ${last_name}`, email, role_id]
        );
        const user_id = newUser.rows[0].id;

        // ----------------------------------------------------
        // STUDENT CREATION
        // ----------------------------------------------------

        const newStudent = await client.query(
            `INSERT INTO students (
                admission_no, roll_no, class_id, section_id, admission_date, category,
                first_name, last_name, gender, dob, cnic_bform,
                religion, blood_group, has_disability, disability_details,
                student_mobile, email, current_address, permanent_address, city,
                father_name, father_phone, father_cnic, father_occupation,
                mother_name, mother_phone, mother_cnic, mother_occupation,
                is_orphan, guardian_name, guardian_relation, guardian_phone, guardian_cnic, guardian_address,
                monthly_fee, admission_fee, other_charges,
                image_url, documents, user_id,
                family_id, sibling_relation
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22, $23, $24,
                $25, $26, $27, $28,
                $29, $30, $31, $32, $33, $34,
                $35, $36, $37,
                $38, $39, $40,
                $41, $42
            )
            RETURNING *`,
            [
                auto_admission_no, roll_no, class_id, section_id, admission_date || new Date(), category || 'Normal',
                first_name, last_name, gender, dob, cnic_bform,
                religion, blood_group, has_disability === 'true' || has_disability === true, disability_details,
                mobile_no, email, current_address, permanent_address, city,
                father_name, father_phone, father_cnic, father_occupation,
                mother_name, mother_phone, mother_cnic, mother_occupation,
                is_orphan === 'true' || is_orphan === true, guardian_name, guardian_relation, guardian_phone, guardian_cnic, guardian_address,
                monthly_fee || 0, admission_fee || 0, other_charges || 0,
                image_url, JSON.stringify(documents), user_id,
                family_id, final_sibling_relation
            ]
        );

        const new_student_id = newStudent.rows[0].student_id;

        // Create sibling relationships for all siblings
        if (siblingsArray.length > 0) {
            for (const sibling of siblingsArray) {
                const { sibling_id, relation_type } = sibling;

                // Create forward relationship
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                    [new_student_id, sibling_id, relation_type]
                );

                // Create reverse relationship
                await client.query(
                    `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                    [sibling_id, new_student_id, relation_type]
                );
            }
        }

        // -------------------------------------------------------
        // AUTO-CREATE ADMISSION FEE LEDGER
        // If admission_fee > 0, create a ledger entry for this
        // student that will track outstanding balance until paid
        // -------------------------------------------------------
        const admFeeVal = parseFloat(admission_fee) || 0;
        if (admFeeVal > 0) {
            await client.query(`
                INSERT INTO admission_fee_ledger
                    (student_id, total_amount, paid_amount, status, admission_date, notes)
                VALUES ($1, $2, 0, 'unpaid', $3, 'Auto-created on admission')
                ON CONFLICT (student_id) DO UPDATE
                    SET total_amount = EXCLUDED.total_amount,
                        status = CASE WHEN EXCLUDED.total_amount = 0 THEN 'paid' ELSE 'unpaid' END
            `, [new_student_id, admFeeVal, admission_date || new Date()]);
        }

        await client.query('COMMIT');
        // Return student with family_fee info
        const familyInfo = await pool.query(`SELECT family_fee FROM families WHERE family_id = $1`, [family_id]);
        const studentRow = newStudent.rows[0];
        studentRow.family_fee = familyInfo.rows[0]?.family_fee || 0;
        res.json(newStudent.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            console.log("UNIQUE CONSTRAINT VIOLATION:", err.detail);
            return res.status(400).json({ error: "System generated a duplicate Admission No or Username (" + err.detail + "). Please try again." });
        }
        console.error(err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    } finally {
        client.release();
    }
});

// 2. Bulk Import
router.post('/bulk', async (req, res) => {
    const client = await pool.connect();
    try {
        const { students } = req.body; // Expecting array of objects
        if (!students || !Array.isArray(students)) {
            return res.status(400).json({ error: "Invalid data format. Expected array of students." });
        }

        await client.query('BEGIN');

        const results = {
            success: 0,
            failed: 0,
            errors: [],
            familyStats: {
                newFamilies: 0,
                linkedByCNIC: 0,
                linkedByNamePhone: 0,
                totalStudents: 0
            }
        };

        // 1. Pre-fetch Classes and Sections for Name-to-ID Resolution
        const allClasses = await client.query("SELECT class_id, class_name FROM classes");
        const allSections = await client.query("SELECT section_id, section_name, class_id FROM sections");

        // Helper to find ID (Case Insensitive)
        const getClassId = (name) => {
            if (!name) return null;
            // If already numeric, return it
            if (!isNaN(name)) return parseInt(name);
            const found = allClasses.rows.find(c => c.class_name.trim().toLowerCase() === String(name).trim().toLowerCase());
            return found ? found.class_id : null;
        };

        const getSectionId = (secName, clsId) => {
            if (!secName || !clsId) return null;
            if (!isNaN(secName)) return parseInt(secName);
            const found = allSections.rows.find(s =>
                s.class_id === clsId &&
                s.section_name.trim().toLowerCase() === String(secName).trim().toLowerCase()
            );
            return found ? found.section_id : null;
        };

        let studentIdx = 0;
        for (const rawS of students) {
            studentIdx++;
            const spName = "sp_student_" + studentIdx;
            try { await client.query("SAVEPOINT " + spName); } catch (e) { }

            let s = {};
            try {
                // Normalize incoming keys to handle Excel header variations
                Object.keys(rawS).forEach(key => {
                    const normKey = key.trim().toLowerCase().replace(/\s+/g, '_');
                    s[normKey] = rawS[key];
                    // Also support common variants
                    if (normKey === 'class_name' || normKey === 'class') s.class_name = rawS[key];
                    if (normKey === 'section_name' || normKey === 'section') s.section_name = rawS[key];
                    if (normKey === 'firstname' || normKey === 'first_name') s.first_name = rawS[key];
                    if (normKey === 'lastname' || normKey === 'last_name') s.last_name = rawS[key];
                });

                // Helper to parse Excel dates (which might come as epoch numbers)
                const parseDate = (d) => {
                    if (!d) return null;
                    if (!isNaN(d) && typeof d === 'number') {
                        // Excel epoch to JS Date
                        return new Date(Math.round((d - 25569) * 86400 * 1000));
                    }
                    return new Date(d);
                };

                // Resolve IDs
                let targetClassId = getClassId(s.class_name || s.class_id);
                let targetSectionId = getSectionId(s.section_name || s.section_id, targetClassId);

                if (!targetClassId) throw new Error(`Class '${s.class_name || s.class_id || 'Empty'}' not found.`);
                if (!targetSectionId) throw new Error(`Section '${s.section_name || s.section_id || 'Empty'}' not found in Class.`);

                // Parse dates properly
                s.dob = parseDate(s.dob);
                s.admission_date = parseDate(s.admission_date);

                // Auto ID Generation Logic if not provided
                let finalAdmissionNo = s.admission_no;
                if (!finalAdmissionNo || finalAdmissionNo === 'AUTO') {
                    const dateObj = s.admission_date ? new Date(s.admission_date) : new Date();
                    const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const year = dateObj.getFullYear();
                    const prefix = `${month}${day}${year}`;

                    // Check for collision in current transaction or DB
                    // Note: In high volume bulk, this sequential query might be slow. 
                    // Optimization: We could lock table or use a sequence. 
                    // For now, we trust the iterative select-insert.

                    const lastStudentResult = await client.query(
                        "SELECT admission_no FROM students WHERE admission_no LIKE $1 ORDER BY admission_no DESC LIMIT 1",
                        [`${prefix}%`]
                    );

                    let sequence = '001';
                    if (lastStudentResult.rows.length > 0) {
                        const lastAdm = lastStudentResult.rows[0].admission_no;
                        const lastSeq = parseInt(lastAdm.replace(prefix, ''));
                        if (!isNaN(lastSeq)) {
                            sequence = String(lastSeq + 1).padStart(3, '0');
                        }
                    }
                    finalAdmissionNo = `${prefix}${sequence}`;
                }

                // ============================================
                // PHASE 1: CNIC-BASED FAMILY LINKING
                // ============================================
                let family_id = null;
                let linkage_source = 'new';
                let sibling_relation = null;

                // Strategy 1: Father CNIC Match (Most Reliable)
                if (s.father_cnic && s.father_cnic.trim() !== '') {
                    const existingFamily = await client.query(
                        `SELECT family_id, student_id, first_name 
                         FROM students 
                         WHERE father_cnic = $1 
                         ORDER BY created_at DESC 
                         LIMIT 1`,
                        [s.father_cnic.trim()]
                    );

                    if (existingFamily.rows.length > 0) {
                        family_id = existingFamily.rows[0].family_id;
                        linkage_source = 'cnic_match';
                        sibling_relation = 'blood';
                        results.familyStats.linkedByCNIC++;
                    }
                }

                // Strategy 2: Father Name + Phone Match (Backup)
                if (!family_id && s.father_name && s.father_phone) {
                    const phoneMatch = await client.query(
                        `SELECT family_id, student_id 
                         FROM students 
                         WHERE LOWER(father_name) = LOWER($1) 
                           AND father_phone = $2
                         LIMIT 1`,
                        [s.father_name.trim(), s.father_phone.trim()]
                    );

                    if (phoneMatch.rows.length > 0) {
                        family_id = phoneMatch.rows[0].family_id;
                        linkage_source = 'name_phone_match';
                        sibling_relation = 'blood';
                        results.familyStats.linkedByNamePhone++;
                    }
                }

                // Strategy 3: Generate NEW Family ID
                if (!family_id) {
                    family_id = await generateFamilyId(client);
                    linkage_source = 'new_family';
                    results.familyStats.newFamilies++;
                }

                // Insert Student with Family ID
                const insertResult = await client.query(
                    `INSERT INTO students (
                        admission_no, roll_no, class_id, section_id, admission_date, category,
                        first_name, last_name, gender, dob, cnic_bform,
                        religion, blood_group, 
                        student_mobile, email, current_address, permanent_address, city,
                        father_name, father_phone, father_cnic, father_occupation,
                        mother_name, mother_phone, mother_cnic, mother_occupation,
                        guardian_name, guardian_relation, guardian_phone, guardian_cnic, guardian_address,
                        monthly_fee, admission_fee, family_id, sibling_relation
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6,
                        $7, $8, $9, $10, $11,
                        $12, $13, 
                        $14, $15, $16, $17, $18,
                        $19, $20, $21, $22,
                        $23, $24, $25, $26,
                        $27, $28, $29, $30, $31,
                        $32, $33, $34, $35
                    )
                    RETURNING student_id`,
                    [
                        finalAdmissionNo, s.roll_no, targetClassId, targetSectionId, s.admission_date || new Date(), s.category || 'Normal',
                        s.first_name, s.last_name, s.gender, s.dob, s.cnic_bform,
                        s.religion, s.blood_group,
                        s.student_mobile, s.email, s.current_address, s.permanent_address, s.city,
                        s.father_name, s.father_phone, s.father_cnic, s.father_occupation,
                        s.mother_name, s.mother_phone, s.mother_cnic, s.mother_occupation,
                        s.guardian_name, s.guardian_relation, s.guardian_phone, s.guardian_cnic, s.guardian_address,
                        s.monthly_fee || 0, s.admission_fee || 0, family_id, sibling_relation
                    ]
                );

                const newStudentId = insertResult.rows[0].student_id;

                // Create Sibling Relationships if linked
                if (linkage_source === 'cnic_match' || linkage_source === 'name_phone_match') {
                    const siblings = await client.query(
                        `SELECT student_id FROM students 
                         WHERE family_id = $1 AND student_id != $2`,
                        [family_id, newStudentId]
                    );

                    for (const sibling of siblings.rows) {
                        await client.query(
                            `INSERT INTO student_siblings (student_id, sibling_id, relation_type)
                             VALUES ($1, $2, 'blood'), ($2, $1, 'blood')
                             ON CONFLICT (student_id, sibling_id) DO NOTHING`,
                            [newStudentId, sibling.student_id]
                        );
                    }
                }

                // Upsert families record (with optional opening_balance)
                const bulkFamilyFee = parseFloat(s.family_fee) || 0;
                const bulkOpb = parseFloat(s.opening_balance) || 0;
                await client.query(`
                    INSERT INTO families (family_id, family_fee, opening_balance, created_at)
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT (family_id) DO UPDATE
                        SET family_fee = CASE WHEN $2 > 0 THEN $2 ELSE families.family_fee END,
                            opening_balance = CASE WHEN $3 > 0 THEN $3 ELSE families.opening_balance END
                `, [family_id, bulkFamilyFee, bulkOpb]);

                // Handle User Profile for Bulk Import
                let username = 'STU-' + finalAdmissionNo;
                let uIdx = 1;
                let isUnique = false;
                while (!isUnique) {
                    const existRes = await client.query('SELECT id FROM app_users WHERE username = $1', [username]);
                    if (existRes.rows.length === 0) {
                        isUnique = true;
                    } else {
                        username = 'STU-' + finalAdmissionNo + '-' + uIdx;
                        uIdx++;
                    }
                }
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash('student123', salt);

                let roleRes = await client.query("SELECT id FROM app_roles WHERE role_name = 'Student'");
                let role_id = roleRes.rows.length > 0 ? roleRes.rows[0].id : null;
                if (!role_id) {
                    const newRole = await client.query("INSERT INTO app_roles (role_name, description) VALUES ('Student', 'Standard Access') RETURNING id");
                    role_id = newRole.rows[0].id;
                }

                const newUser = await client.query(
                    "INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id",
                    [username, password_hash, 'student123', (s.first_name + ' ' + (s.last_name || '')).trim(), s.email || '', role_id]
                );
                const user_id = newUser.rows[0].id;

                await client.query("UPDATE students SET user_id = $1 WHERE student_id = $2", [user_id, newStudentId]);

                results.success++;
                results.familyStats.totalStudents++;
            } catch (err) {
                try { await client.query("ROLLBACK TO SAVEPOINT " + spName); } catch (e) { }

                // If collision on generated ID (race condition), retry logic could be added here
                results.failed++;
                results.errors.push({ name: s.first_name || rawS.first_name || rawS['First Name'] || 'Unknown Student', error: err.message });
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Import processing complete", results });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Server Error during bulk import" });
    } finally {
        client.release();
    }
});

// 3. Get All Students (With Filters)
router.get('/', async (req, res) => {
    try {
        const { class_id, section_id, gender, keyword, category, status, blood_group, is_orphan, family_id, age, religion } = req.query;

        let query = `
            SELECT s.*, c.class_name, sec.section_name, u.username, u.plain_password as system_pwd
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            LEFT JOIN app_users u ON s.user_id = u.id 
            WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (class_id && class_id.trim() !== '') {
            query += ` AND s.class_id = $${paramCount}`;
            params.push(class_id.trim());
            paramCount++;
        }

        if (section_id && section_id.trim() !== '') {
            query += ` AND s.section_id = $${paramCount}`;
            params.push(section_id.trim());
            paramCount++;
        }

        if (gender && gender.trim() !== '') {
            query += ` AND LOWER(TRIM(s.gender)) = LOWER($${paramCount})`;
            params.push(gender.trim());
            paramCount++;
        }

        if (category && category.trim() !== '') {
            query += ` AND LOWER(TRIM(s.category)) = LOWER($${paramCount})`;
            params.push(category.trim());
            paramCount++;
        }

        if (status && status.trim() !== '') {
            query += ` AND LOWER(TRIM(s.status)) = LOWER($${paramCount})`;
            params.push(status.trim());
            paramCount++;
        }

        if (blood_group && blood_group.trim() !== '') {
            query += ` AND LOWER(TRIM(s.blood_group)) = LOWER($${paramCount})`;
            params.push(blood_group.trim());
            paramCount++;
        }

        if (is_orphan !== undefined && is_orphan !== null && is_orphan !== '') {
            query += ` AND s.is_orphan = $${paramCount}`;
            params.push(is_orphan === 'true' || is_orphan === true);
            paramCount++;
        }

        if (family_id && family_id.trim() !== '') {
            query += ` AND s.family_id ILIKE $${paramCount}`;
            params.push(`%${family_id.trim()}%`);
            paramCount++;
        }

        if (keyword && keyword.trim() !== '') {
            const kw = keyword.trim();
            query += ` AND (
                s.first_name ILIKE $${paramCount} OR 
                s.last_name ILIKE $${paramCount} OR 
                CONCAT(s.first_name, ' ', s.last_name) ILIKE $${paramCount} OR
                CONCAT(s.last_name, ' ', s.first_name) ILIKE $${paramCount} OR
                s.admission_no ILIKE $${paramCount} OR
                s.roll_no ILIKE $${paramCount} OR
                s.father_name ILIKE $${paramCount} OR
                s.mother_name ILIKE $${paramCount} OR
                s.guardian_name ILIKE $${paramCount} OR
                s.student_mobile ILIKE $${paramCount} OR
                s.father_phone ILIKE $${paramCount} OR
                s.family_id ILIKE $${paramCount} OR
                u.username ILIKE $${paramCount}
            )`;
            params.push(`%${kw}%`);
            paramCount++;
        }

        if (age && age.toString().trim() !== '' && !isNaN(parseInt(age.toString()))) {
            query += ` AND s.dob IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.dob)) = $${paramCount}::int`;
            params.push(parseInt(age.toString()));
            paramCount++;
        }

        if (religion && religion.trim() !== '') {
            query += ` AND LOWER(TRIM(s.religion)) = LOWER($${paramCount})`;
            params.push(religion.trim());
            paramCount++;
        }

        query += ` ORDER BY s.class_id NULLS LAST, s.section_id NULLS LAST, s.roll_no NULLS LAST, s.first_name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Error in GET /students:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// 4. Get Single Student
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const student = await pool.query(`
            SELECT s.*, c.class_name, sec.section_name, u.username, u.plain_password as system_pwd,
                   COALESCE(f.family_fee, 0) AS family_fee,
                   COALESCE(f.opening_balance, 0) AS opening_balance,
                   COALESCE(f.opening_balance_paid, 0) AS opening_balance_paid,
                   GREATEST(0, COALESCE(f.opening_balance, 0) - COALESCE(f.opening_balance_paid, 0)) AS opb_remaining,
                   f.opb_notes,
                   (SELECT COUNT(*)::int FROM students s2 WHERE s2.family_id = s.family_id AND s2.status = 'Active') AS family_size
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.class_id
            LEFT JOIN sections sec ON s.section_id = sec.section_id
            LEFT JOIN app_users u ON s.user_id = u.id
            LEFT JOIN families f ON f.family_id = s.family_id
            WHERE s.student_id = $1
        `, [id]);

        if (student.rows.length === 0) return res.status(404).json({ error: "Student not found" });
        res.json(student.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// 5. Update Student (Full Edit)
router.put('/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'documents', maxCount: 5 }]), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            roll_no, class_id, section_id, admission_date, category,
            first_name, last_name, gender, dob, cnic_bform,
            religion, blood_group, has_disability, disability_details,
            mobile_no, email, current_address, permanent_address, city,
            father_name, father_phone, father_cnic, father_occupation,
            mother_name, mother_phone, mother_cnic, mother_occupation,
            is_orphan, guardian_name, guardian_relation, guardian_phone, guardian_cnic, guardian_address,
            monthly_fee, admission_fee, other_charges,
            family_fee, opening_balance
        } = req.body;

        // Handle Files
        let image_url = req.body.existing_image_url || null;
        if (req.files['image'] && req.files['image'][0]) {
            image_url = req.files['image'][0].path.replace(/\\/g, "/");
        }

        let documents = [];
        if (req.body.existing_documents) {
            try { documents = JSON.parse(req.body.existing_documents); } catch (e) { }
        }
        if (req.files['documents']) {
            const newDocs = req.files['documents'].map(f => f.path.replace(/\\/g, "/"));
            documents = [...documents, ...newDocs];
        }

        await client.query('BEGIN');

        const updateQ = `UPDATE students SET
            roll_no=$1, class_id=$2, section_id=$3, admission_date=$4, category=$5,
            first_name=$6, last_name=$7, gender=$8, dob=$9, cnic_bform=$10,
            religion=$11, blood_group=$12, has_disability=$13, disability_details=$14,
            student_mobile=$15, email=$16, current_address=$17, permanent_address=$18, city=$19,
            father_name=$20, father_phone=$21, father_cnic=$22, father_occupation=$23,
            mother_name=$24, mother_phone=$25, mother_cnic=$26, mother_occupation=$27,
            is_orphan=$28, guardian_name=$29, guardian_relation=$30, guardian_phone=$31, guardian_cnic=$32, guardian_address=$33,
            monthly_fee=$34, admission_fee=$35, other_charges=$36,
            image_url=$37, documents=$38
            WHERE student_id=$39 RETURNING user_id, family_id`;

        const vals = [
            roll_no && String(roll_no).trim() !== '' ? String(roll_no).trim() : null,
            class_id && !isNaN(parseInt(class_id, 10)) ? parseInt(class_id, 10) : null,
            section_id && !isNaN(parseInt(section_id, 10)) ? parseInt(section_id, 10) : null,
            admission_date && String(admission_date).trim() !== '' ? String(admission_date).trim() : null,
            category || 'Normal',
            first_name ? String(first_name).trim() : '',
            last_name && String(last_name).trim() !== '' ? String(last_name).trim() : null,
            gender && String(gender).trim() !== '' ? String(gender).trim() : null,
            dob && String(dob).trim() !== '' ? String(dob).trim() : null,
            cnic_bform && String(cnic_bform).trim() !== '' ? String(cnic_bform).trim() : null,
            religion && String(religion).trim() !== '' ? String(religion).trim() : null,
            blood_group && String(blood_group).trim() !== '' ? String(blood_group).trim() : null,
            has_disability === 'true' || has_disability === true,
            disability_details && String(disability_details).trim() !== '' ? String(disability_details).trim() : null,
            mobile_no && String(mobile_no).trim() !== '' ? String(mobile_no).trim() : null,
            email && String(email).trim() !== '' ? String(email).trim() : null,
            current_address && String(current_address).trim() !== '' ? String(current_address).trim() : null,
            permanent_address && String(permanent_address).trim() !== '' ? String(permanent_address).trim() : null,
            city && String(city).trim() !== '' ? String(city).trim() : null,
            father_name && String(father_name).trim() !== '' ? String(father_name).trim() : null,
            father_phone && String(father_phone).trim() !== '' ? String(father_phone).trim() : null,
            father_cnic && String(father_cnic).trim() !== '' ? String(father_cnic).trim() : null,
            father_occupation && String(father_occupation).trim() !== '' ? String(father_occupation).trim() : null,
            mother_name && String(mother_name).trim() !== '' ? String(mother_name).trim() : null,
            mother_phone && String(mother_phone).trim() !== '' ? String(mother_phone).trim() : null,
            mother_cnic && String(mother_cnic).trim() !== '' ? String(mother_cnic).trim() : null,
            mother_occupation && String(mother_occupation).trim() !== '' ? String(mother_occupation).trim() : null,
            is_orphan === 'true' || is_orphan === true,
            guardian_name && String(guardian_name).trim() !== '' ? String(guardian_name).trim() : null,
            guardian_relation && String(guardian_relation).trim() !== '' ? String(guardian_relation).trim() : null,
            guardian_phone && String(guardian_phone).trim() !== '' ? String(guardian_phone).trim() : null,
            guardian_cnic && String(guardian_cnic).trim() !== '' ? String(guardian_cnic).trim() : null,
            guardian_address && String(guardian_address).trim() !== '' ? String(guardian_address).trim() : null,
            !isNaN(parseFloat(monthly_fee)) ? parseFloat(monthly_fee) : 0,
            !isNaN(parseFloat(admission_fee)) ? parseFloat(admission_fee) : 0,
            !isNaN(parseFloat(other_charges)) ? parseFloat(other_charges) : 0,
            image_url || null,
            JSON.stringify(documents),
            id
        ];

        const resUpd = await client.query(updateQ, vals);

        if (resUpd.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Student not found" });
        }

        const user_id = resUpd.rows[0].user_id;
        const fam_id_updated = resUpd.rows[0].family_id;

        // Update family fee in families table if provided
        if (family_fee !== undefined && family_fee !== null && family_fee !== '' && !isNaN(parseFloat(family_fee)) && parseFloat(family_fee) > 0 && fam_id_updated) {
            await client.query(`
                INSERT INTO families (family_id, family_fee)
                VALUES ($1, $2)
                ON CONFLICT (family_id) DO UPDATE SET family_fee = $2
            `, [fam_id_updated, parseFloat(family_fee)]);
        }

        // Update opening_balance in families table if provided
        if (opening_balance !== undefined && opening_balance !== null && opening_balance !== '' && fam_id_updated) {
            const opbVal = parseFloat(opening_balance);
            if (!isNaN(opbVal) && opbVal >= 0) {
                const famRes = await client.query(`SELECT opening_balance, opening_balance_paid FROM families WHERE family_id = $1`, [fam_id_updated]);
                const currentOpb = parseFloat(famRes.rows[0]?.opening_balance || 0);
                const currentPaid = parseFloat(famRes.rows[0]?.opening_balance_paid || 0);

                if (currentPaid > 0 && currentPaid >= currentOpb && currentOpb > 0) {
                    // Fully paid: do not edit opening_balance
                } else {
                    const finalOpb = Math.max(opbVal, currentPaid);
                    await client.query(`
                        INSERT INTO families (family_id, opening_balance, created_at)
                        VALUES ($1, $2, NOW())
                        ON CONFLICT (family_id) DO UPDATE SET opening_balance = $2
                    `, [fam_id_updated, finalOpb]);
                }
            }
        }

        // Update User
        if (user_id) {
            const fullName = `${first_name || ''} ${last_name || ''}`.trim() || 'Student';
            await client.query(
                "UPDATE app_users SET full_name = $1, email = $2 WHERE id = $3",
                [fullName, email && String(email).trim() !== '' ? String(email).trim() : null, user_id]
            );
        }

        // Create or Update Admission Fee Ledger on Edit
        const admFeeVal = parseFloat(admission_fee) || 0;
        const validAdmDate = (admission_date && String(admission_date).trim() !== '') ? String(admission_date).trim() : new Date();
        if (admFeeVal > 0) {
            await client.query(`
                INSERT INTO admission_fee_ledger 
                    (student_id, total_amount, paid_amount, status, admission_date, notes)
                VALUES ($1, $2, 0, 'unpaid', $3, 'Auto-created/Updated via student edit')
                ON CONFLICT (student_id) DO UPDATE 
                    SET total_amount = EXCLUDED.total_amount,
                        status = CASE 
                            WHEN admission_fee_ledger.paid_amount >= EXCLUDED.total_amount THEN 'paid'
                            WHEN admission_fee_ledger.paid_amount > 0 THEN 'partial'
                            ELSE 'unpaid'
                        END
            `, [id, admFeeVal, validAdmDate]);
        } else {
            await client.query(`
                UPDATE admission_fee_ledger
                SET total_amount = 0, status = 'paid'
                WHERE student_id = $1 AND paid_amount = 0
            `, [id]);
        }

        await client.query('COMMIT');
        res.json({ message: "Updated successfully" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Server Error: " + err.message });
    } finally {
        client.release();
    }
});

// 6. Toggle Status
router.patch('/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return res.status(400).json({ error: "Status is required" });

        await client.query('BEGIN');

        // Update Student
        const studentRes = await client.query(
            "UPDATE students SET status = $1 WHERE student_id = $2 RETURNING user_id",
            [status, id]
        );

        if (studentRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Student not found" });
        }

        const user_id = studentRes.rows[0].user_id;

        // Update User if linked
        if (user_id) {
            const isActive = (status === 'Active');
            await client.query("UPDATE app_users SET is_active = $1 WHERE id = $2", [isActive, user_id]);
        }

        await client.query('COMMIT');
        res.json({ message: "Status updated successfully", status });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    } finally {
        client.release();
    }
});

// 7. Generate Credentials (Manual)
router.patch('/:id/generate-credentials', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        // 1. Get Student Info
        const sRes = await client.query("SELECT * FROM students WHERE student_id = $1", [id]);
        if (sRes.rows.length === 0) return res.status(404).json({ error: "Student not found" });
        const student = sRes.rows[0];

        if (student.user_id) return res.status(400).json({ error: "User already exists" });

        // 2. Generate Credentials
        const username = `STU-${student.admission_no}`;
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash('student123', salt);

        // 3. Get Role
        let roleRes = await client.query("SELECT id FROM app_roles WHERE role_name = 'Student'");
        let role_id = roleRes.rows.length > 0 ? roleRes.rows[0].id : null;
        if (!role_id) {
            const newRole = await client.query("INSERT INTO app_roles (role_name, description) VALUES ('Student', 'Standard Access') RETURNING id");
            role_id = newRole.rows[0].id;
        }

        // 4. Create User
        const newUser = await client.query(
            `INSERT INTO app_users (username, password_hash, plain_password, full_name, email, role_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
            [username, password_hash, 'student123', `${student.first_name} ${student.last_name}`, student.email, role_id]
        );
        const user_id = newUser.rows[0].id;

        // 5. Link to Student
        await client.query("UPDATE students SET user_id = $1 WHERE student_id = $2", [user_id, id]);

        await client.query('COMMIT');
        res.json({ message: "Credentials Generated", username });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Server Error: " + err.message });
    } finally {
        client.release();
    }
});

// 8. Change Password
router.patch('/:id/change-password', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        await client.query('BEGIN');

        // Get User ID
        const sRes = await client.query("SELECT user_id FROM students WHERE student_id = $1", [id]);
        if (sRes.rows.length === 0) return res.status(404).json({ error: "Student not found" });

        const user_id = sRes.rows[0].user_id;
        if (!user_id) return res.status(400).json({ error: "Student has no system login" });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Update User
        await client.query("UPDATE app_users SET password_hash = $1, plain_password = $2 WHERE id = $3", [password_hash, password, user_id]);

        await client.query('COMMIT');
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    } finally {
        client.release();
    }
});

// 9. Delete Student
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM students WHERE student_id = $1", [id]);
        res.json({ message: "Student deleted successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// ══════════════════════════════════════════════════════════
//  OPENING BALANCE (OPB) ROUTES
// ══════════════════════════════════════════════════════════

// GET /students/opb/families
// List all families with their opening balance info + members
router.get('/opb/families', async (req, res) => {
    try {
        const { search, filter } = req.query;

        let where = '';
        const params = [];

        if (filter === 'with_opb') {
            where = 'WHERE f.opening_balance > 0';
        } else if (filter === 'cleared') {
            where = 'WHERE f.opening_balance > 0 AND f.opening_balance_paid >= f.opening_balance';
        } else if (filter === 'pending') {
            where = 'WHERE f.opening_balance > 0 AND f.opening_balance_paid < f.opening_balance';
        }

        const result = await pool.query(`
            SELECT
                f.family_id,
                f.family_name,
                f.primary_contact_name,
                f.primary_contact_phone,
                f.opening_balance,
                f.opening_balance_paid,
                GREATEST(f.opening_balance - f.opening_balance_paid, 0) AS opb_remaining,
                f.opb_notes,
                f.family_fee,
                -- Members summary
                COUNT(s.student_id) AS total_members,
                MAX(s.father_name) AS father_name,
                MAX(s.father_phone) AS father_phone,
                STRING_AGG(s.first_name || ' ' || s.last_name, ', ' ORDER BY s.first_name) AS member_names,
                STRING_AGG(c.class_name, ', ' ORDER BY c.class_name) AS class_names
            FROM families f
            LEFT JOIN students s ON s.family_id = f.family_id AND s.status = 'Active'
            LEFT JOIN classes c ON c.class_id = s.class_id
            ${where}
            GROUP BY f.family_id, f.family_name, f.primary_contact_name, f.primary_contact_phone,
                     f.opening_balance, f.opening_balance_paid, f.opb_notes, f.family_fee
            ORDER BY opb_remaining DESC, f.family_id
        `, params);

        // Optional search
        let rows = result.rows;
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                (r.father_name || '').toLowerCase().includes(q) ||
                (r.family_id || '').toLowerCase().includes(q) ||
                (r.member_names || '').toLowerCase().includes(q) ||
                (r.father_phone || '').includes(q)
            );
        }

        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /students/opb/families/:family_id
// Full OPB detail for one family including payment history
router.get('/opb/families/:family_id', async (req, res) => {
    try {
        const { family_id } = req.params;

        const familyRes = await pool.query(`
            SELECT f.*,
                GREATEST(f.opening_balance - f.opening_balance_paid, 0) AS opb_remaining
            FROM families f WHERE f.family_id = $1
        `, [family_id]);

        if (familyRes.rows.length === 0)
            return res.status(404).json({ error: 'Family not found' });

        const members = await pool.query(`
            SELECT s.student_id, s.admission_no, s.first_name, s.last_name, c.class_name
            FROM students s
            LEFT JOIN classes c ON c.class_id = s.class_id
            WHERE s.family_id = $1 AND s.status = 'Active'
            ORDER BY s.first_name
        `, [family_id]);

        const payments = await pool.query(`
            SELECT * FROM family_opb_payments
            WHERE family_id = $1
            ORDER BY payment_date DESC, created_at DESC
        `, [family_id]);

        res.json({
            ...familyRes.rows[0],
            members: members.rows,
            payments: payments.rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /students/opb/families/:family_id
// Set or update opening balance for a family
router.put('/opb/families/:family_id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { family_id } = req.params;
        const { opening_balance, opb_notes } = req.body;

        if (opening_balance === undefined || isNaN(parseFloat(opening_balance)))
            return res.status(400).json({ error: 'opening_balance is required and must be a number' });

        const bal = parseFloat(opening_balance);
        if (bal < 0) return res.status(400).json({ error: 'opening_balance cannot be negative' });

        await client.query('BEGIN');

        // Upsert family record
        await client.query(`
            INSERT INTO families (family_id, opening_balance, opb_notes, family_fee)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (family_id) DO UPDATE
                SET opening_balance = $2,
                    opb_notes = COALESCE($3, families.opb_notes)
        `, [family_id, bal, opb_notes || null]);

        const updated = await client.query(`
            SELECT f.*,
                GREATEST(f.opening_balance - f.opening_balance_paid, 0) AS opb_remaining
            FROM families f WHERE f.family_id = $1
        `, [family_id]);

        await client.query('COMMIT');
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// POST /students/opb/families/:family_id/payment
// Record a payment towards opening balance
router.post('/opb/families/:family_id/payment', async (req, res) => {
    const client = await pool.connect();
    try {
        const { family_id } = req.params;
        const { amount, payment_date, payment_method, received_by, reference_no, notes } = req.body;

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
            return res.status(400).json({ error: 'amount is required and must be > 0' });

        await client.query('BEGIN');

        // Get current OPB state
        const familyRes = await client.query(
            `SELECT opening_balance, opening_balance_paid FROM families WHERE family_id = $1`,
            [family_id]
        );
        if (familyRes.rows.length === 0)
            return res.status(404).json({ error: 'Family not found' });

        const { opening_balance, opening_balance_paid } = familyRes.rows[0];
        const remaining = parseFloat(opening_balance) - parseFloat(opening_balance_paid);
        const payAmt = Math.min(parseFloat(amount), remaining); // can't pay more than remaining

        if (payAmt <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Opening balance is already fully paid' });
        }

        // Record payment in ledger
        const payment = await client.query(`
            INSERT INTO family_opb_payments
                (family_id, amount, payment_date, payment_method, received_by, reference_no, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [family_id, payAmt, payment_date || new Date().toISOString().split('T')[0],
            payment_method || 'cash', received_by || null, reference_no || null, notes || null]);

        // Update families.opening_balance_paid
        await client.query(`
            UPDATE families
            SET opening_balance_paid = opening_balance_paid + $1
            WHERE family_id = $2
        `, [payAmt, family_id]);

        const updatedFamily = await client.query(`
            SELECT f.*,
                GREATEST(f.opening_balance - f.opening_balance_paid, 0) AS opb_remaining
            FROM families f WHERE f.family_id = $1
        `, [family_id]);

        await client.query('COMMIT');
        res.json({
            payment: payment.rows[0],
            family: updatedFamily.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// DELETE /students/opb/families/:family_id/payment/:payment_id
// Delete an OPB payment entry (reverse payment)
router.delete('/opb/families/:family_id/payment/:payment_id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { family_id, payment_id } = req.params;

        await client.query('BEGIN');

        const pmtRes = await client.query(
            `SELECT amount FROM family_opb_payments WHERE payment_id = $1 AND family_id = $2`,
            [payment_id, family_id]
        );
        if (pmtRes.rows.length === 0)
            return res.status(404).json({ error: 'Payment not found' });

        const amt = parseFloat(pmtRes.rows[0].amount);

        await client.query(`DELETE FROM family_opb_payments WHERE payment_id = $1`, [payment_id]);
        await client.query(`
            UPDATE families
            SET opening_balance_paid = GREATEST(opening_balance_paid - $1, 0)
            WHERE family_id = $2
        `, [amt, family_id]);

        await client.query('COMMIT');
        res.json({ message: 'Payment reversed successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

module.exports = router;
