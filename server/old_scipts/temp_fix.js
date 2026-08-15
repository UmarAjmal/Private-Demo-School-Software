const fs = require('fs');
let code = fs.readFileSync('server/routes/fee-slips.js', 'utf8');
code = code.replace(/sec\.section_name\s*\/\/\ Group by family_id/, 
`sec.section_name
            ORDER BY s.family_id NULLS LAST, c.class_id DESC NULLS LAST, s.first_name
        \`, [month, year]);

        const allSlips = result.rows;

        // Group by family_id`);
fs.writeFileSync('server/routes/fee-slips.js', code);
