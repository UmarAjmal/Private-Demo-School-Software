const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Load environment configuration
const MASTER_FOLDER_ID = process.env.GOOGLE_MASTER_FOLDER_ID || '1vIW4PHGL4xiB9uABjIjTnexTOyuMIiFG';
const ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL || 'umarajmaldeveloper@gmail.com';
const KEY_FILE_PATH = path.resolve(__dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'google-service-account.json');

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send'
];

let authClient = null;
let driveClient = null;
let docsClient = null;
let slidesClient = null;
let sheetsClient = null;

function getAuth() {
    if (authClient) return authClient;

    if (!fs.existsSync(KEY_FILE_PATH)) {
        throw new Error(`Google Service Account JSON key file not found at: ${KEY_FILE_PATH}`);
    }

    authClient = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: SCOPES
    });

    return authClient;
}

function getDrive() {
    if (!driveClient) {
        driveClient = google.drive({ version: 'v3', auth: getAuth() });
    }
    return driveClient;
}

function getDocs() {
    if (!docsClient) {
        docsClient = google.docs({ version: 'v1', auth: getAuth() });
    }
    return docsClient;
}

function getSlides() {
    if (!slidesClient) {
        slidesClient = google.slides({ version: 'v1', auth: getAuth() });
    }
    return slidesClient;
}

function getSheets() {
    if (!sheetsClient) {
        sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
    }
    return sheetsClient;
}

/**
 * Verify connection to Google Drive & access to the Master Folder
 */
async function verifyConnection() {
    try {
        const drive = getDrive();
        const res = await drive.files.get({
            fileId: MASTER_FOLDER_ID,
            fields: 'id, name, mimeType, owners',
            supportsAllDrives: true
        });
        return {
            success: true,
            folderName: res.data.name,
            folderId: res.data.id
        };
    } catch (err) {
        console.error('❌ Google Drive Verification Error:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Get or create a folder inside a parent folder
 */
async function getOrCreateFolder(parentFolderId, folderName) {
    const drive = getDrive();
    const query = `'${parentFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const existing = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    if (existing.data.files && existing.data.files.length > 0) {
        return existing.data.files[0].id;
    }

    const created = await drive.files.create({
        resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        },
        fields: 'id, name',
        supportsAllDrives: true
    });

    return created.data.id;
}

/**
 * Automatically creates structured folder hierarchy:
 * Master Folder -> [Academic Year] -> [Class Name] -> [Subject Name]
 */
async function getTargetAcademicFolder({ academicYearName = 'Academic 2026-2027', className = 'General', subjectName = 'General' }) {
    try {
        const yearFolderId = await getOrCreateFolder(MASTER_FOLDER_ID, academicYearName);
        const classFolderId = await getOrCreateFolder(yearFolderId, className);
        const subjectFolderId = await getOrCreateFolder(classFolderId, subjectName);
        return subjectFolderId;
    } catch (err) {
        console.warn('⚠️ Could not create nested folders, falling back to Master Folder:', err.message);
        return MASTER_FOLDER_ID;
    }
}

/**
 * Grant viewing and editing permissions
 */
async function grantFilePermissions(fileId, teacherEmail) {
    const drive = getDrive();

    try {
        // Make accessible to anyone with link for seamless iframe embedding inside the SMS
        await drive.permissions.create({
            fileId,
            resource: {
                role: 'writer',
                type: 'anyone'
            },
            supportsAllDrives: true
        });

        // If teacher email is provided, explicitly invite them
        if (teacherEmail && teacherEmail.includes('@') && !teacherEmail.includes('placeholder')) {
            await drive.permissions.create({
                fileId,
                resource: {
                    role: 'writer',
                    type: 'user',
                    emailAddress: teacherEmail
                },
                sendNotificationEmail: false,
                supportsAllDrives: true
            }).catch(e => console.warn('Teacher permission invite warning:', e.message));
        }

        // Grant Admin access
        if (ADMIN_EMAIL && ADMIN_EMAIL.includes('@')) {
            await drive.permissions.create({
                fileId,
                resource: {
                    role: 'writer',
                    type: 'user',
                    emailAddress: ADMIN_EMAIL
                },
                sendNotificationEmail: false,
                supportsAllDrives: true
            }).catch(e => console.warn('Admin permission invite warning:', e.message));
        }
    } catch (err) {
        console.warn('⚠️ Non-fatal permission assignment warning:', err.message);
    }
}

/**
 * Switch permissions during workflow (e.g. lock editing on submit/approval)
 */
async function setDocumentAccessMode(fileId, mode = 'edit') {
    const drive = getDrive();
    try {
        const role = (mode === 'lock' || mode === 'read_only') ? 'reader' : 'writer';
        // Update anyone permission
        const perms = await drive.permissions.list({ fileId, supportsAllDrives: true });
        const anyonePerm = perms.data.permissions.find(p => p.type === 'anyone');
        if (anyonePerm) {
            await drive.permissions.update({
                fileId,
                permissionId: anyonePerm.id,
                resource: { role },
                supportsAllDrives: true
            });
        }
    } catch (err) {
        console.warn('⚠️ Could not update permission mode:', err.message);
    }
}

/**
 * Create a new Academic Document (Google Doc / Slide / Sheet) with pre-formatted School Header
 */
async function createAcademicDocument({
    templateType = 'doc', // 'doc', 'slide', 'sheet'
    title = 'Academic Document',
    category = 'exam', // 'exam', 'test', 'notes', 'summer_pack', 'presentation', 'marksheet'
    className = 'Class 10',
    subjectName = 'Physics',
    academicYear = '2026-2027',
    termName = 'Mid-Term',
    totalMarks = 50,
    teacherName = 'Subject Teacher',
    teacherEmail = '',
    instructions = ''
}) {
    const drive = getDrive();
    const targetFolderId = await getTargetAcademicFolder({
        academicYearName: academicYear,
        className,
        subjectName
    });

    let createdFileId = null;
    let webViewLink = null;
    let embedLink = null;

    if (templateType === 'slide' || category === 'presentation') {
        // --- 1. GOOGLE SLIDES ---
        const slides = getSlides();
        const presentation = await slides.presentations.create({
            resource: { title }
        });
        createdFileId = presentation.data.presentationId;

        // Move to target folder
        await drive.files.update({
            fileId: createdFileId,
            addParents: targetFolderId,
            supportsAllDrives: true
        });

        // Initialize Title Slide
        try {
            await slides.presentations.batchUpdate({
                presentationId: createdFileId,
                resource: {
                    requests: [
                        {
                            insertText: {
                                objectId: presentation.data.slides[0].pageElements[0].objectId,
                                text: `${title}\n${className} — ${subjectName}`
                            }
                        }
                    ]
                }
            });
        } catch (e) { /* ignore layout differences */ }

    } else if (templateType === 'sheet' || category === 'marksheet') {
        // --- 2. GOOGLE SHEETS ---
        const sheets = getSheets();
        const spreadsheet = await sheets.spreadsheets.create({
            resource: {
                properties: { title },
                sheets: [
                    {
                        properties: { title: 'Assessment & Marks' },
                        data: [
                            {
                                startRow: 0,
                                startColumn: 0,
                                rowData: [
                                    {
                                        values: [
                                            { userEnteredValue: { stringValue: 'Roll No' } },
                                            { userEnteredValue: { stringValue: 'Student Name' } },
                                            { userEnteredValue: { stringValue: 'Assignment (10)' } },
                                            { userEnteredValue: { stringValue: 'Quiz (10)' } },
                                            { userEnteredValue: { stringValue: 'Mid-Term (30)' } },
                                            { userEnteredValue: { stringValue: 'Final Exam (50)' } },
                                            { userEnteredValue: { stringValue: 'Total (100)' } },
                                            { userEnteredValue: { stringValue: 'Grade' } },
                                            { userEnteredValue: { stringValue: 'Status' } }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        });
        createdFileId = spreadsheet.data.spreadsheetId;

        // Move to target folder
        await drive.files.update({
            fileId: createdFileId,
            addParents: targetFolderId,
            supportsAllDrives: true
        });

    } else {
        // --- 3. GOOGLE DOCS (Default for Exam, Test, Notes, Summer Pack) ---
        const docs = getDocs();
        const doc = await docs.documents.create({
            resource: { title }
        });
        createdFileId = doc.data.documentId;

        // Move to target folder
        await drive.files.update({
            fileId: createdFileId,
            addParents: targetFolderId,
            supportsAllDrives: true
        });

        // Insert Rich School Header & Formatted Structure
        const categoryLabel = {
            exam: 'OFFICIAL EXAMINATION PAPER',
            test: 'CLASSROOM ASSESSMENT TEST',
            notes: 'SUBJECT LECTURE NOTES & STUDY GUIDE',
            summer_pack: 'SUMMER VACATION HOMEWORK PACK'
        }[category] || 'ACADEMIC STUDY MATERIAL';

        const headerText =
            `SMART PRIVATE SCHOOL SYSTEM\n` +
            `${categoryLabel}\n\n` +
            `Subject: ${subjectName}  |  Class: ${className}  |  Term: ${termName} (${academicYear})\n` +
            `Total Marks: ${totalMarks}  |  Time Allowed: 2.5 Hours  |  Teacher: ${teacherName}\n` +
            `----------------------------------------------------------------------------------------------------\n` +
            `INSTRUCTIONS: ${instructions || 'Attempt all questions. Neatness and presentation carry credit.'}\n` +
            `----------------------------------------------------------------------------------------------------\n\n` +
            `SECTION A: OBJECTIVE / MULTIPLE CHOICE QUESTIONS (15 Marks)\n` +
            `Q1. Choose the correct answer from the given options:\n` +
            `    i. ..................................................................................... [A/B/C/D]\n` +
            `    ii. .................................................................................... [A/B/C/D]\n` +
            `    iii. ................................................................................... [A/B/C/D]\n\n` +
            `SECTION B: SHORT QUESTIONS (20 Marks)\n` +
            `Q2. Answer any 5 of the following short questions:\n` +
            `    1. .....................................................................................\n` +
            `    2. .....................................................................................\n` +
            `    3. .....................................................................................\n\n` +
            `SECTION C: DESCRIPTIVE / LONG QUESTIONS (15 Marks)\n` +
            `Q3. Answer the following detailed questions in full:\n` +
            `    a) .....................................................................................\n\n`;

        try {
            await docs.documents.batchUpdate({
                documentId: createdFileId,
                resource: {
                    requests: [
                        {
                            insertText: {
                                location: { index: 1 },
                                text: headerText
                            }
                        }
                    ]
                }
            });
        } catch (e) {
            console.warn('Doc formatting warning:', e.message);
        }
    }

    // Grant proper permissions
    await grantFilePermissions(createdFileId, teacherEmail);

    // Build responsive editing and embedding URLs
    if (templateType === 'slide') {
        webViewLink = `https://docs.google.com/presentation/d/${createdFileId}/edit`;
        embedLink = `https://docs.google.com/presentation/d/${createdFileId}/embed?start=false&loop=false&delayms=3000`;
    } else if (templateType === 'sheet') {
        webViewLink = `https://docs.google.com/spreadsheets/d/${createdFileId}/edit`;
        embedLink = `https://docs.google.com/spreadsheets/d/${createdFileId}/edit?widget=true&headers=false`;
    } else {
        webViewLink = `https://docs.google.com/document/d/${createdFileId}/edit`;
        embedLink = `https://docs.google.com/document/d/${createdFileId}/edit?embedded=true`;
    }

    return {
        fileId: createdFileId,
        webViewLink,
        embedLink,
        targetFolderId
    };
}

/**
 * Export document as PDF stream/buffer
 */
async function exportDocumentAsPdf(fileId) {
    const drive = getDrive();
    const res = await drive.files.export(
        { fileId, mimeType: 'application/pdf' },
        { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
}

module.exports = {
    verifyConnection,
    createAcademicDocument,
    setDocumentAccessMode,
    exportDocumentAsPdf,
    getTargetAcademicFolder
};
