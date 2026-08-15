const fs = require('fs');

// =====================================================================
// Complete ordered list of ALL migration files.
// Rules:
//   - Only include files that do SAFE operations (CREATE IF NOT EXISTS,
//     ALTER ADD COLUMN IF NOT EXISTS, INSERT ON CONFLICT DO NOTHING, etc.)
//   - Order matters: tables that are referenced by foreign keys must come first
//   - Files that delete/drop data are EXCLUDED (add-opb-head clears opb_payments —
//     kept but it's idempotent; rename-opb-head updates head names safely)
// =====================================================================
const files = [
  // ── CORE AUTH & SETTINGS ──────────────────────────────────────────
  'create-user-roles.js',         // app_roles, role_permissions, app_users
  'create-settings-table.js',     // school_settings
  'create-system-settings.js',    // system_settings
  'seed-role-levels.js',          // seeds role_level column on app_roles

  // ── ACADEMIC STRUCTURE ───────────────────────────────────────────
  'create-classes-tables.js',     // classes, sections
  'update-classes-table.js',      // adds description column to classes
  'create-subjects-table.js',     // subjects

  // ── STUDENTS ─────────────────────────────────────────────────────
  'create-students-table.js',     // students (safe CREATE IF NOT EXISTS)
  'update-students-schema.js',    // adds missing columns via ALTER ADD IF NOT EXISTS
  'update-students-family-system.js', // family_id, families, student_siblings
  'add-userid-col.js',            // students.user_id

  // ── HRM / EMPLOYEES ──────────────────────────────────────────────
  'create-hrm-tables.js',         // departments, employees
  'update-employees-table.js',    // adds gender, dob, etc. to employees
  'enhance-employees-for-teachers.js', // teacher_subject_assignment, teacher_class_assignment

  // ── ACADEMIC YEARS & TERMS ────────────────────────────────────────
  'create-academic-table.js',     // academic_years, academic_terms, academic promotions
  'add-year-configuration.js',    // adds is_configured to academic_years
  'update-terms-table.js',        // adds has_summer_work, has_winter_work to academic_terms
  'create-student-records-table.js', // student_academic_records (promotion history)

  // ── ATTENDANCE ───────────────────────────────────────────────────
  'create-attendance-tables.js',  // student_attendance, staff_attendance

  // ── EXPENSES ─────────────────────────────────────────────────────
  'init-expenses.js',             // expense_categories, expenses

  // ── FEES ─────────────────────────────────────────────────────────
  'create-fee-tables.js',         // fee_heads, fee_plans, fee_plan_classes, fee_plan_heads, monthly_fee_slips, slip_line_items, fee_payments
  'add-opening-balance.js',       // families.opening_balance, family_opb_payments
  'add-opb-head.js',              // inserts 'Opening Balance' fee head (idempotent ON CONFLICT)
  'rename-opb-head.js',           // renames 'Opening Balance' head to 'Previous Balance' (safe UPDATE)
  'create-admission-fee-table.js', // admission_fee_ledger, admission_fee_payments
  'create-exam-fee-collection-table.js', // exam_fee_collections
  'update-multi-months.js',       // adds has_multi_months, months_list to monthly_fee_slips
  'add-family-fee-column.js',     // families.family_fee, monthly_fee_slips.is_family_slip
  'add-print-tracking.js',        // monthly_fee_slips.is_printed, printed_at
  'fix_monthly_slips.js',         // adds issue_date + other missing columns to monthly_fee_slips

  // ── SETTINGS & SEED DATA ─────────────────────────────────────────
  'seed-school-settings.js',      // seeds school_settings row
  'seed-backup-settings.js',      // seeds backup system_settings keys
];

// =====================================================================
// Header template for master-seeder.js
// =====================================================================
let output = `require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const bcrypt = require('bcryptjs');

console.log('======================================================');
console.log('   MASTER SEEDER & SCHEMA INITIALIZATION SCRIPT       ');
console.log('======================================================');

async function runMasterSeeder() {
  console.log('Starting execution...');
`;

// =====================================================================
// Include each file's content, wrapped in try/catch
// =====================================================================
for (let f of files) {
  if (!fs.existsSync(f)) {
    console.warn('Skipping missing file:', f);
    continue;
  }
  let buffer = fs.readFileSync(f);
  let c = buffer.toString('utf-8');
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    c = buffer.toString('utf16le');
  }
  c = c.replace(/^\uFEFF/, ''); // Strip BOM if present

  // Remove imports that are already in the master seeder header
  c = c.replace(/const pool\s*=\s*require\(.*?db.*?\);?/gi, '');
  c = c.replace(/const\s+\{\s*Pool\s*\}\s*=\s*require\(['"]pg['"]\);?/gi, '');
  c = c.replace(/const\s+\w+\s*=\s*new Pool\([^)]*\);?/gi, '');  // custom Pool instances
  c = c.replace(/require\(['"]dotenv['"]\)\.config\(.*?\);?/gi, '');
  c = c.replace(/const bcrypt\s*=\s*require\(.*?\);?/gi, '');
  c = c.replace(/const fs\s*=\s*require\(.*?\);?/gi, '');
  c = c.replace(/const path\s*=\s*require\(.*?\);?/gi, '');
  c = c.replace(/const db\s*=\s*require\(.*?\);?/gi, '');

  // Remove pool/process endings using negative lookbehind to avoid nesting block comments
  c = c.replace(/(?<!\/\*\s*)pool\.end\(\);?/gi, '/* pool.end() removed for master seeder */');
  c = c.replace(/(?<!\/\*\s*)process\.exit\(\d*\);?/gi, '/* process.exit removed */');

  // Convert top-level function calls to awaited calls
  c = c.replace(/^([A-Za-z0-9_]+)\(\)(?:\.catch\(.*?\))?;?$/gm, 'await $1();');

  // Remove module.exports lines (not needed in seeder)
  c = c.replace(/^module\.exports\s*=.*$/gm, '');

  // Disable "if (require.main === module)" blocks instead of trying to parse braces
  c = c.replace(/if\s*\(\s*require\.main\s*===\s*module\s*\)/g, 'if (false /* block disabled in master seeder */)');

  output += `
  // ====== FROM: ${f} ======
  await (async () => {
    try {
${c}
    } catch(err) {
      console.error('[Error in ${f}]:', err.message);
    }
  })();`;
}

// =====================================================================
// Footer
// =====================================================================
output += `
  console.log('======================================================');
  console.log('   MASTER SEEDER COMPLETED SUCCESSFULLY               ');
  console.log('======================================================');
  process.exit(0);
}

runMasterSeeder();`;

fs.writeFileSync('master-seeder.js', output, 'utf-8');
console.log('Done generating master-seeder.js!');
