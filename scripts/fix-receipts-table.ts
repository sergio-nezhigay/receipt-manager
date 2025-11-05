import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function fixReceiptsTable() {
  try {
    console.log('Fixing receipts table schema...\n');

    // 1. Add receipt_url column if missing
    console.log('Adding receipt_url column...');
    try {
      await sql`
        ALTER TABLE receipts
        ADD COLUMN IF NOT EXISTS receipt_url TEXT
      `;
      console.log('✓ receipt_url column added');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('✓ receipt_url column already exists');
      } else {
        throw error;
      }
    }

    // 2. Rename fiscal_number to fiscal_code for consistency
    console.log('\nChecking fiscal_code column...');
    const checkFiscalCode = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'receipts'
        AND column_name = 'fiscal_code'
    `;

    if (checkFiscalCode.rows.length === 0) {
      // Column doesn't exist, rename fiscal_number to fiscal_code
      console.log('Renaming fiscal_number to fiscal_code...');
      await sql`
        ALTER TABLE receipts
        RENAME COLUMN fiscal_number TO fiscal_code
      `;
      console.log('✓ fiscal_number renamed to fiscal_code');
    } else {
      console.log('✓ fiscal_code column already exists');
    }

    // 3. Add issued_at column (in addition to created_at)
    console.log('\nAdding issued_at column...');
    try {
      await sql`
        ALTER TABLE receipts
        ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP
      `;
      console.log('✓ issued_at column added');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('✓ issued_at column already exists');
      } else {
        throw error;
      }
    }

    // 4. Make amount nullable (payment amount is stored in payments table)
    console.log('\nMaking amount column nullable...');
    try {
      await sql`
        ALTER TABLE receipts
        ALTER COLUMN amount DROP NOT NULL
      `;
      console.log('✓ amount column is now nullable');
    } catch (error: any) {
      console.log('Note: amount column modification skipped:', error.message);
    }

    console.log('\n✅ Receipts table fixed successfully!');
    console.log('\nUpdated schema:');
    console.log('- receipt_url: TEXT (for web view link)');
    console.log('- fiscal_code: VARCHAR(100) (renamed from fiscal_number)');
    console.log('- issued_at: TIMESTAMP (receipt issue date)');
    console.log('- amount: DECIMAL (nullable)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixReceiptsTable();
