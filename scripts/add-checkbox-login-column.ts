import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function addCheckboxLoginColumn() {
  try {
    console.log('Adding checkbox_cashier_login column to companies table...\n');

    // Check if column already exists
    const checkColumn = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'companies'
        AND column_name = 'checkbox_cashier_login'
    `;

    if (checkColumn.rows.length > 0) {
      console.log('✓ Column checkbox_cashier_login already exists');
      process.exit(0);
    }

    // Add the column
    await sql`
      ALTER TABLE companies
      ADD COLUMN checkbox_cashier_login VARCHAR(255)
    `;

    console.log('✅ Successfully added checkbox_cashier_login column');
    console.log('\nNote: This column stores the Checkbox cashier login (username)');
    console.log('The password is stored in checkbox_cashier_pin_encrypted');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addCheckboxLoginColumn();
