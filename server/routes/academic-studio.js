const express = require('express');
const router = express.Router();
const pool = require('../db');
const googleWorkspace = require('../services/googleWorkspace');

// 1. Get All Templates
router.get('/templates', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM academic_templates 
            WHERE is_active = TRUE 
            ORDER BY id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching academic templates:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. List Academic Documents (with rich filtering)
router.get('/documents', async (req, res) => {
    try {
        const {
            class_id,
            subject_id,
            category,
            status,
            created_by_teacher_id,
            is_published_to_students,
            search
        } = req.query;

        let query = `
            SELECT 
                d.*,
                c.class_name,
                sec.section_name,
                s.subject_name,
                ay.year_name as academic_year_name,
                at.term_name,
                u.full_name as teacher_name,
                u.email as teacher_email,
                rev.full_name as current_reviewer_name
            FROM academic_documents d
            LEFT JOIN classes c ON d.class_id = c.class_id
            LEFT JOIN sections sec ON d.section_id = sec.section_id
            LEFT JOIN subjects s ON d.subject_id = s.subject_id
            LEFT JOIN academic_years ay ON d.academic_year_id = ay.id
            LEFT JOIN academic_terms at ON d.term_id = at.id
            LEFT JOIN app_users u ON d.created_by_teacher_id = u.id
            LEFT JOIN app_users rev ON d.current_reviewer_id = rev.id
            WHERE 1=1
        `;

        const params = [];
        let paramIdx = 1;

        if (class_id) {
            query += ` AND d.class_id = $${paramIdx++}`;
            params.push(class_id);
        }
        if (req.query.section_id) {
            query += ` AND d.section_id = $${paramIdx++}`;
            params.push(req.query.section_id);
        }
        if (subject_id) {
            query += ` AND d.subject_id = $${paramIdx++}`;
            params.push(subject_id);
        }
        if (category) {
            query += ` AND d.category = $${paramIdx++}`;
            params.push(category);
        }
        if (status) {
            query += ` AND d.status = $${paramIdx++}`;
            params.push(status);
        }
        if (created_by_teacher_id) {
            query += ` AND d.created_by_teacher_id = $${paramIdx++}`;
            params.push(created_by_teacher_id);
        }
        if (is_published_to_students !== undefined) {
            query += ` AND d.is_published_to_students = $${paramIdx++}`;
            params.push(is_published_to_students === 'true');
        }
        if (search) {
            query += ` AND (d.title ILIKE $${paramIdx} OR c.class_name ILIKE $${paramIdx} OR s.subject_name ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        query += ` ORDER BY d.updated_at DESC, d.id DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching academic documents:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Get Single Document with Approval History
router.get('/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const docRes = await pool.query(`
            SELECT 
                d.*,
                c.class_name,
                sec.section_name,
                s.subject_name,
                ay.year_name as academic_year_name,
                at.term_name,
                u.full_name as teacher_name,
                u.email as teacher_email,
                rev.full_name as current_reviewer_name
            FROM academic_documents d
            LEFT JOIN classes c ON d.class_id = c.class_id
            LEFT JOIN sections sec ON d.section_id = sec.section_id
            LEFT JOIN subjects s ON d.subject_id = s.subject_id
            LEFT JOIN academic_years ay ON d.academic_year_id = ay.id
            LEFT JOIN academic_terms at ON d.term_id = at.id
            LEFT JOIN app_users u ON d.created_by_teacher_id = u.id
            LEFT JOIN app_users rev ON d.current_reviewer_id = rev.id
            WHERE d.id = $1
        `, [id]);

        if (docRes.rows.length === 0) {
            return res.status(404).json({ error: 'Academic document not found' });
        }

        const approvalsRes = await pool.query(`
            SELECT 
                a.*,
                u.full_name as reviewer_name,
                u.email as reviewer_email
            FROM academic_document_approvals a
            LEFT JOIN app_users u ON a.reviewer_user_id = u.id
            WHERE a.document_id = $1
            ORDER BY a.created_at ASC
        `, [id]);

        res.json({
            ...docRes.rows[0],
            approvals: approvalsRes.rows
        });
    } catch (err) {
        console.error('Error fetching document details:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Create New Document (Google Docs / Slides / Sheets Engine)
router.post('/documents', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            title,
            category = 'exam',
            template_type = 'doc',
            class_id,
            section_id,
            subject_id,
            academic_year_id,
            term_id,
            created_by_teacher_id,
            total_marks = 50,
            scheduled_date,
            instructions = ''
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Document title is required' });
        }

        await client.query('BEGIN');

        // Fetch Class Name, Section Name, Subject Name, and Academic Year Name
        let className = 'General Class';
        let sectionName = '';
        let subjectName = 'General Subject';
        let yearName = 'Academic 2026-2027';
        let termName = 'Mid-Term';
        let teacherName = 'Subject Teacher';
        let teacherEmail = '';

        if (class_id) {
            const clRes = await client.query('SELECT class_name FROM classes WHERE class_id = $1', [class_id]);
            if (clRes.rows.length > 0) className = clRes.rows[0].class_name;
        }

        if (section_id) {
            const scRes = await client.query('SELECT section_name FROM sections WHERE section_id = $1', [section_id]);
            if (scRes.rows.length > 0) {
                sectionName = scRes.rows[0].section_name;
                className = `${className} (${sectionName})`;
            }
        }

        if (subject_id) {
            const sbRes = await client.query('SELECT subject_name FROM subjects WHERE subject_id = $1', [subject_id]);
            if (sbRes.rows.length > 0) subjectName = sbRes.rows[0].subject_name;
        }

        if (academic_year_id) {
            const yrRes = await client.query('SELECT year_name FROM academic_years WHERE id = $1', [academic_year_id]);
            if (yrRes.rows.length > 0) yearName = yrRes.rows[0].year_name;
        }

        if (term_id) {
            const tmRes = await client.query('SELECT term_name FROM academic_terms WHERE id = $1', [term_id]);
            if (tmRes.rows.length > 0) termName = tmRes.rows[0].term_name;
        }

        if (created_by_teacher_id) {
            const tcRes = await client.query('SELECT full_name, email FROM app_users WHERE id = $1', [created_by_teacher_id]);
            if (tcRes.rows.length > 0) {
                teacherName = tcRes.rows[0].full_name;
                teacherEmail = tcRes.rows[0].email || '';
            }
        }

        // Call Google Workspace Engine to create cloud document
        const gResult = await googleWorkspace.createAcademicDocument({
            templateType: template_type,
            title: title.trim(),
            category,
            className,
            subjectName,
            academicYear: yearName,
            termName,
            totalMarks: parseInt(total_marks) || 50,
            teacherName,
            teacherEmail,
            instructions
        });

        // Insert Record in PostgreSQL
        const insertRes = await client.query(`
            INSERT INTO academic_documents (
                title, category, template_type, class_id, section_id, subject_id, 
                academic_year_id, term_id, created_by_teacher_id,
                google_file_id, google_webview_link, google_embed_link, google_folder_id,
                status, current_reviewer_role, total_marks, scheduled_date, instructions
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft', 'Coordinator', $14, $15, $16)
            RETURNING *
        `, [
            title.trim(),
            category,
            template_type,
            class_id || null,
            section_id || null,
            subject_id || null,
            academic_year_id || null,
            term_id || null,
            created_by_teacher_id || null,
            gResult.fileId,
            gResult.webViewLink,
            gResult.embedLink,
            gResult.targetFolderId,
            parseInt(total_marks) || 50,
            scheduled_date || null,
            instructions || ''
        ]);

        const newDoc = insertRes.rows[0];

        // Add Initial Audit log
        await client.query(`
            INSERT INTO academic_document_approvals (
                document_id, reviewer_user_id, reviewer_role, action, remarks
            ) VALUES ($1, $2, 'Teacher', 'created', 'Document created in Google Workspace')
        `, [newDoc.id, created_by_teacher_id || null]);

        await client.query('COMMIT');
        res.status(201).json(newDoc);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating academic document:', err);
        res.status(500).json({ error: 'Failed to create document: ' + err.message });
    } finally {
        client.release();
    }
});

// 5. Submit Document for Review (Locks editing, notifies coordinator)
router.post('/documents/:id/submit', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { user_id, remarks = 'Submitted for academic review' } = req.body;

        await client.query('BEGIN');

        const docRes = await client.query('SELECT * FROM academic_documents WHERE id = $1', [id]);
        if (docRes.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const doc = docRes.rows[0];

        // Update Google Doc permission to lock editing during review
        if (doc.google_file_id) {
            await googleWorkspace.setDocumentAccessMode(doc.google_file_id, 'lock');
        }

        // Update Status to Pending Coordinator
        const updateRes = await client.query(`
            UPDATE academic_documents 
            SET status = 'pending_coordinator', 
                current_reviewer_role = 'Coordinator',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);

        // Audit Trail
        await client.query(`
            INSERT INTO academic_document_approvals (
                document_id, reviewer_user_id, reviewer_role, action, remarks
            ) VALUES ($1, $2, 'Teacher', 'submitted', $3)
        `, [id, user_id || doc.created_by_teacher_id, remarks]);

        // Create In-App Notification for Coordinators & Admins
        await client.query(`
            INSERT INTO notifications (
                role, type, title, message, link
            ) VALUES ('Administrator', 'academic_review', 'New Document Submitted for Review', $1, $2)
        `, [
            `"${doc.title}" has been submitted for Coordinator review.`,
            `/academic/approvals`
        ]);

        await client.query('COMMIT');
        res.json({ message: 'Document successfully submitted for review', document: updateRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error submitting document for review:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 6. Multi-Tier Review Action (Coordinator / Vice Principal / Principal)
router.post('/documents/:id/review', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            reviewer_user_id,
            reviewer_role = 'Coordinator', // 'Coordinator', 'Vice Principal', 'Principal', 'Administrator'
            action, // 'approve', 'request_revision', 'reject'
            remarks = ''
        } = req.body;

        if (!action || !['approve', 'request_revision', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Valid action (approve, request_revision, reject) is required' });
        }

        await client.query('BEGIN');

        const docRes = await client.query('SELECT * FROM academic_documents WHERE id = $1', [id]);
        if (docRes.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const doc = docRes.rows[0];

        let nextStatus = doc.status;
        let nextReviewerRole = doc.current_reviewer_role;

        if (action === 'approve') {
            const roleLower = reviewer_role.toLowerCase();
            if (roleLower.includes('admin') || roleLower.includes('principal')) {
                // Final Approval
                nextStatus = 'approved';
                nextReviewerRole = 'None';
                // Auto publish notes and summer packs
                if (['notes', 'summer_pack', 'presentation'].includes(doc.category)) {
                    await client.query(`
                        UPDATE academic_documents 
                        SET is_published_to_students = TRUE, published_at = CURRENT_TIMESTAMP 
                        WHERE id = $1
                    `, [id]);
                }
            } else if (roleLower.includes('vp') || roleLower.includes('vice')) {
                nextStatus = 'pending_principal';
                nextReviewerRole = 'Principal';
            } else {
                // Coordinator approved -> Next is Vice Principal
                nextStatus = 'pending_vp';
                nextReviewerRole = 'Vice Principal';
            }
        } else if (action === 'request_revision') {
            nextStatus = 'revision_requested';
            nextReviewerRole = 'Teacher';
            // Unlock Google Doc for teacher editing
            if (doc.google_file_id) {
                await googleWorkspace.setDocumentAccessMode(doc.google_file_id, 'edit');
            }
        } else if (action === 'reject') {
            nextStatus = 'rejected';
            nextReviewerRole = 'None';
        }

        const updateRes = await client.query(`
            UPDATE academic_documents 
            SET status = $1, 
                current_reviewer_role = $2,
                current_reviewer_id = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [nextStatus, nextReviewerRole, reviewer_user_id || null, id]);

        // Insert Audit Log
        await client.query(`
            INSERT INTO academic_document_approvals (
                document_id, reviewer_user_id, reviewer_role, action, remarks
            ) VALUES ($1, $2, $3, $4, $5)
        `, [id, reviewer_user_id || null, reviewer_role, action, remarks]);

        // Notify Teacher
        if (doc.created_by_teacher_id) {
            const notifMsg = action === 'approve'
                ? `Your document "${doc.title}" was approved by ${reviewer_role}. Status: ${nextStatus.toUpperCase()}`
                : action === 'request_revision'
                    ? `Changes requested on "${doc.title}" by ${reviewer_role}: "${remarks}"`
                    : `Your document "${doc.title}" was marked as rejected by ${reviewer_role}.`;

            await client.query(`
                INSERT INTO notifications (
                    user_id, type, title, message, link
                ) VALUES ($1, 'academic_review', 'Document Review Update', $2, $3)
            `, [doc.created_by_teacher_id, notifMsg, `/academic/studio`]);
        }

        await client.query('COMMIT');
        res.json({
            message: `Document status updated to ${nextStatus}`,
            document: updateRes.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error reviewing academic document:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 7. Export Document as PDF (Direct from Google Drive)
router.get('/documents/:id/export-pdf', async (req, res) => {
    try {
        const { id } = req.params;
        const docRes = await pool.query('SELECT * FROM academic_documents WHERE id = $1', [id]);
        if (docRes.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const doc = docRes.rows[0];

        if (!doc.google_file_id) {
            return res.status(400).json({ error: 'No Google Drive file attached to this document' });
        }

        const pdfBuffer = await googleWorkspace.exportDocumentAsPdf(doc.google_file_id);

        const safeFilename = doc.title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Error exporting PDF:', err);
        res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
    }
});

// 8. Toggle Publish to Student & Parent Portal
router.patch('/documents/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_published } = req.body;

        const updateRes = await pool.query(`
            UPDATE academic_documents 
            SET is_published_to_students = $1,
                published_at = CASE WHEN $1 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [Boolean(is_published), id]);

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({
            message: `Document ${is_published ? 'published to' : 'hidden from'} Student Portal`,
            document: updateRes.rows[0]
        });
    } catch (err) {
        console.error('Error publishing document:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9. Get Study Materials for a Student's Class (for Student & Parent Portal Documents Tab)
router.get('/student-materials', async (req, res) => {
    try {
        const { class_id, category } = req.query;

        let query = `
            SELECT 
                d.id,
                d.title,
                d.category,
                d.template_type,
                d.google_file_id,
                d.google_webview_link,
                d.google_embed_link,
                d.published_at,
                d.instructions,
                c.class_name,
                s.subject_name,
                at.term_name,
                u.full_name as teacher_name
            FROM academic_documents d
            LEFT JOIN classes c ON d.class_id = c.class_id
            LEFT JOIN subjects s ON d.subject_id = s.subject_id
            LEFT JOIN academic_terms at ON d.term_id = at.id
            LEFT JOIN app_users u ON d.created_by_teacher_id = u.id
            WHERE d.is_published_to_students = TRUE 
              AND d.status = 'approved'
        `;

        const params = [];
        let paramIdx = 1;

        if (class_id) {
            query += ` AND (d.class_id = $${paramIdx++} OR d.class_id IS NULL)`;
            params.push(class_id);
        }
        if (category) {
            query += ` AND d.category = $${paramIdx++}`;
            params.push(category);
        }

        query += ` ORDER BY d.published_at DESC, d.id DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching student study materials:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. Delete Document
router.delete('/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM academic_documents WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ message: 'Academic document deleted successfully' });
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
