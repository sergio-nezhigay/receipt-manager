import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function addPaymentFields() {
  try {
    console.log('🔧 Adding missing fields to payments table...\n');

    // Add sender_tax_id column if it doesn't exist
    console.log('Adding sender_tax_id column...');
    try {
      await sql`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS sender_tax_id VARCHAR(50);
      `;
      console.log('✓ sender_tax_id column added');
    } catch (error) {
      console.log('ℹ️  sender_tax_id column already exists or error:', error);
    }

    // Add document_number column if it doesn't exist
    console.log('Adding document_number column...');
    try {
      await sql`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS document_number VARCHAR(100);
      `;
      console.log('✓ document_number column added');
    } catch (error) {
      console.log('ℹ️  document_number column already exists or error:', error);
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

addPaymentFields()
  .then(() => {
    console.log('\n💡 Payments table updated successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
