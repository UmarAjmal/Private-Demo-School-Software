const pool = require('./db');
async function run() {
    const r = await pool.query(
        `UPDATE fee_heads SET head_name='Previous Balance', head_type='prev_balance'
         WHERE head_type='opb' RETURNING head_id, head_name, head_type`
    );
    console.log('Updated rows:', r.rows);

    // Also update any existing slip_line_items that still say 'Opening Balance'
    const li = await pool.query(
        `UPDATE slip_line_items SET head_name='Previous Balance'
         WHERE head_name='Opening Balance' RETURNING item_id`
    );
    console.log('Line items renamed:', li.rowCount);

    pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
