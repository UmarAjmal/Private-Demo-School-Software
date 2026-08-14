const pool = require('./db');

async function createFeeTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Creating Fee Module tables...');

        // 1. Fee Heads - Master list of all charge types
        await client.query(`
            CREATE TABLE IF NOT EXISTS fee_heads (
                head_id SERIAL PRIMARY KEY,
                head_name VARCHAR(100) NOT NULL,
                head_type VARCHAR(30) NOT NULL DEFAULT 'regular',
                -- regular = standard monthly, extra = ad-hoc addition
                frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
                -- monthly, yearly, once
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ fee_heads created');

        // 2. Fee Plans - Template per class per academic year
        await client.query(`
            CREATE TABLE IF NOT EXISTS fee_plans (
                plan_id SERIAL PRIMARY KEY,
                plan_name VARCHAR(150) NOT NULL,
                class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                applies_to_all BOOLEAN DEFAULT FALSE,
                academic_year VARCHAR(20) NOT NULL DEFAULT '2026',
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ fee_plans created');

        // 2.5. Fee Plan Classes - Multi-class mapping
        await client.query(`
            CREATE TABLE IF NOT EXISTS fee_plan_classes (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL REFERENCES fee_plans(plan_id) ON DELETE CASCADE,
                class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                UNIQUE(plan_id, class_id)
            );
        `);
        console.log('✅ fee_plan_classes created');

        // 3. Fee Plan Heads - Which heads belong to a plan and their amounts
        await client.query(`
            CREATE TABLE IF NOT EXISTS fee_plan_heads (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL REFERENCES fee_plans(plan_id) ON DELETE CASCADE,
                head_id INTEGER NOT NULL REFERENCES fee_heads(head_id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                UNIQUE(plan_id, head_id)
            );
        `);
        console.log('✅ fee_plan_heads created');

        // 4. Monthly Fee Slips - One slip per student per month
        await client.query(`
            CREATE TABLE IF NOT EXISTS monthly_fee_slips (
                slip_id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                family_id VARCHAR(50),
                class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
                year INTEGER NOT NULL,
                due_date DATE,
                issue_date DATE,
                has_multi_months BOOLEAN DEFAULT FALSE,
                months_list INTEGER[],
                is_family_slip BOOLEAN DEFAULT FALSE,
                is_printed BOOLEAN DEFAULT FALSE,
                printed_at TIMESTAMP,
                total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
                -- unpaid, partial, paid
                generated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, month, year)
            );
        `);
        console.log('✅ monthly_fee_slips created');

        // 5. Slip Line Items - Individual heads on each slip
        await client.query(`
            CREATE TABLE IF NOT EXISTS slip_line_items (
                item_id SERIAL PRIMARY KEY,
                slip_id INTEGER NOT NULL REFERENCES monthly_fee_slips(slip_id) ON DELETE CASCADE,
                head_id INTEGER REFERENCES fee_heads(head_id) ON DELETE SET NULL,
                head_name VARCHAR(100) NOT NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                note TEXT
            );
        `);
        console.log('✅ slip_line_items created');

        // 6. Fee Payments - Actual money received against a slip
        await client.query(`
            CREATE TABLE IF NOT EXISTS fee_payments (
                payment_id SERIAL PRIMARY KEY,
                slip_id INTEGER NOT NULL REFERENCES monthly_fee_slips(slip_id) ON DELETE CASCADE,
                amount_paid DECIMAL(10,2) NOT NULL,
                payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
                payment_method VARCHAR(30) DEFAULT 'cash',
                -- cash, bank, online, cheque
                received_by VARCHAR(100),
                reference_no VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ fee_payments created');

        // Seed default fee heads
        await client.query(`
            INSERT INTO fee_heads (head_name, head_type, frequency, description)
            VALUES 
                ('Tuition Fee', 'regular', 'monthly', 'Monthly tuition charges'),
                ('Transport Fee', 'regular', 'monthly', 'School bus / transport service'),
                ('Exam Fee', 'extra', 'once', 'Examination charges per term'),
                ('Annual Fund', 'extra', 'yearly', 'Annual school development fund'),
                ('Sports Fee', 'regular', 'monthly', 'Sports activities & PE charges'),
                ('Lab Charges', 'regular', 'monthly', 'Science/Computer lab usage'),
                ('Library Fee', 'regular', 'monthly', 'Library access & maintenance'),
                ('Late Fine', 'extra', 'once', 'Fine for late fee payment')
            ON CONFLICT DO NOTHING;
        `);
        console.log('✅ Default fee heads seeded');

        await client.query('COMMIT');
        console.log('\n✅ Fee Module tables created successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating tables:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

createFeeTables();
