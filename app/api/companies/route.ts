import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { encrypt, decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { handleApiError } from '@/lib/api-error-handler';

// Validation schema for creating a company
const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  tax_id: z.string().min(1, 'Tax ID is required'),
  pb_merchant_id: z.string().optional(),
  pb_api_token: z.string().optional(),
  checkbox_license_key: z.string().optional(),
  checkbox_cashier_login: z.string().optional(),
  checkbox_cashier_pin: z.string().optional(),
});

// GET /api/companies - List all companies
export async function GET() {
  const context = { method: 'GET', path: '/api/companies' };

  try {
    logger.apiRequest(context.method, context.path);

    logger.dbQuery('SELECT all companies');
    const result = await sql`
      SELECT
        id,
        name,
        tax_id,
        pb_merchant_id,
        pb_api_token_encrypted,
        checkbox_license_key_encrypted,
        checkbox_cashier_login,
        checkbox_cashier_pin_encrypted,
        created_at
      FROM companies
      ORDER BY name ASC
    `;

    // Decrypt sensitive fields before sending to frontend
    const companies = result.rows.map((company) => {
      // Safe decrypt helper
      const safeDecrypt = (encrypted: string | null): string | null => {
        if (!encrypted) return null;
        try {
          return decrypt(encrypted);
        } catch (error) {
          logger.error(`Decryption failed for company ${company.id}`, error);
          return null;
        }
      };

      return {
        id: company.id,
        name: company.name,
        tax_id: company.tax_id,
        pb_merchant_id: company.pb_merchant_id,
        pb_api_token: safeDecrypt(company.pb_api_token_encrypted),
        checkbox_license_key: safeDecrypt(company.checkbox_license_key_encrypted),
        checkbox_cashier_login: company.checkbox_cashier_login,
        checkbox_cashier_pin: safeDecrypt(company.checkbox_cashier_pin_encrypted),
        created_at: company.created_at,
      };
    });

    logger.apiResponse(context.method, context.path, 200);
    return NextResponse.json({ companies });
  } catch (error) {
    return handleApiError(error, context);
  }
}

// POST /api/companies - Create a new company
export async function POST(request: NextRequest) {
  const context = { method: 'POST', path: '/api/companies' };

  try {
    logger.apiRequest(context.method, context.path);

    const body = await request.json();

    // Validate input
    const validatedData = createCompanySchema.parse(body);

    logger.info('Creating new company', { name: validatedData.name, tax_id: validatedData.tax_id });

    // Encrypt sensitive fields
    const pbTokenEncrypted = validatedData.pb_api_token
      ? encrypt(validatedData.pb_api_token)
      : null;
    const checkboxLicenseEncrypted = validatedData.checkbox_license_key
      ? encrypt(validatedData.checkbox_license_key)
      : null;
    const checkboxPinEncrypted = validatedData.checkbox_cashier_pin
      ? encrypt(validatedData.checkbox_cashier_pin)
      : null;

    // Insert into database
    logger.dbQuery('INSERT INTO companies');
    const result = await sql`
      INSERT INTO companies (
        name,
        tax_id,
        pb_merchant_id,
        pb_api_token_encrypted,
        checkbox_license_key_encrypted,
        checkbox_cashier_login,
        checkbox_cashier_pin_encrypted
      )
      VALUES (
        ${validatedData.name},
        ${validatedData.tax_id},
        ${validatedData.pb_merchant_id || null},
        ${pbTokenEncrypted},
        ${checkboxLicenseEncrypted},
        ${validatedData.checkbox_cashier_login || null},
        ${checkboxPinEncrypted}
      )
      RETURNING
        id,
        name,
        tax_id,
        pb_merchant_id,
        checkbox_cashier_login,
        created_at
    `;

    const company = result.rows[0];

    logger.info('Company created successfully', { companyId: company.id, name: company.name });
    logger.apiResponse(context.method, context.path, 201);

    return NextResponse.json({
      message: 'Company created successfully',
      company: {
        ...company,
        pb_api_token: validatedData.pb_api_token || null,
        checkbox_license_key: validatedData.checkbox_license_key || null,
        checkbox_cashier_login: validatedData.checkbox_cashier_login || null,
        checkbox_cashier_pin: validatedData.checkbox_cashier_pin || null,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, context);
  }
}
