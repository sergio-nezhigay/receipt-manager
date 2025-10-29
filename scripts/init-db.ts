import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function initDatabase() {
  try {
    console.log('Creating transactions table...');

    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        category VARCHAR(100) DEFAULT 'uncategorized',
        type VARCHAR(10) CHECK (type IN ('debit', 'credit')) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    console.log('Creating indexes...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    `;

    console.log('Database initialized successfully!');
    console.log('Tables created: transactions');

    // Insert sample data for testing
    console.log('Inserting sample transactions...');

    await sql`
      INSERT INTO transactions (amount, description, date, category, type)
      VALUES
        (150.50, 'Grocery Store', NOW() - INTERVAL '2 days', 'food', 'debit'),
        (2500.00, 'Monthly Salary', NOW() - INTERVAL '5 days', 'income', 'credit'),
        (45.99, 'Internet Bill', NOW() - INTERVAL '1 day', 'utilities', 'debit'),
        (89.99, 'Amazon Purchase', NOW(), 'shopping', 'debit')
      ON CONFLICT DO NOTHING;
    `;

    console.log('Sample data inserted!');

    // Display current records
    const result = await sql`SELECT COUNT(*) as count FROM transactions`;
    console.log(`Total transactions in database: ${result.rows[0].count}`);

  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

initDatabase()
  .then(() => {
    console.log('✅ Database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  });
