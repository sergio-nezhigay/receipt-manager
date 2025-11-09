import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { decrypt } from '@/lib/encryption';
import {
  checkboxIssueReceipt,
  uahToKopiyky,
  CheckboxCreateReceiptRequest,
} from '@/lib/checkbox-client';
import { getProductTitle, getProductCode } from '@/lib/product-title';
import { logger } from '@/lib/logger';
import { errors, handleApiError } from '@/lib/api-error-handler';

// Validation schema for receipt creation
const createReceiptSchema = z.object({
  paymentId: z.number().int().positive(),
});

// POST /api/receipts/create
export async function POST(request: NextRequest) {
  const context = { method: 'POST', path: '/api/receipts/create' };

  try {
    logger.apiRequest(context.method, context.path);
    const body = await request.json();

    // Validate input
    const validatedData = createReceiptSchema.parse(body);
    const { paymentId } = validatedData;

    logger.info('Creating receipt for payment', { paymentId });

    // Fetch payment details
    logger.dbQuery('SELECT payment with company details', [paymentId]);
    const paymentResult = await sql`
      SELECT
        p.id,
        p.company_id,
        p.amount,
        p.sender_name,
        p.description,
        p.currency,
        p.receipt_issued,
        c.name AS company_name,
        c.checkbox_license_key_encrypted,
        c.checkbox_cashier_login,
        c.checkbox_cashier_pin_encrypted
      FROM payments p
      INNER JOIN companies c ON p.company_id = c.id
      WHERE p.id = ${paymentId}
    `;

    if (paymentResult.rows.length === 0) {
      logger.warn('Payment not found for receipt creation', { paymentId });
      throw errors.notFound('Payment');
    }

    const payment = paymentResult.rows[0];

    // Check if receipt already issued
    if (payment.receipt_issued) {
      logger.warn('Attempted to create duplicate receipt', { paymentId });
      throw errors.conflict('Receipt already issued for this payment');
    }

    // Check if Checkbox credentials are configured
    if (
      !payment.checkbox_license_key_encrypted ||
      !payment.checkbox_cashier_login ||
      !payment.checkbox_cashier_pin_encrypted
    ) {
      logger.error('Checkbox credentials not configured for company', { companyId: payment.company_id });
      throw errors.badRequest('Checkbox credentials not configured', {
        message: 'Please add Checkbox credentials in company settings',
      });
    }

    // Decrypt credentials
    let licenseKey: string;
    let cashierPin: string;
    try {
      licenseKey = decrypt(payment.checkbox_license_key_encrypted);
      cashierPin = decrypt(payment.checkbox_cashier_pin_encrypted);
    } catch (decryptError) {
      logger.error('Failed to decrypt Checkbox credentials', {
        companyId: payment.company_id,
        error: decryptError,
      });
      throw errors.badRequest('Failed to decrypt Checkbox credentials', {
        message: 'The stored credentials could not be decrypted. Please re-enter your Checkbox credentials in company settings.',
        details: 'This may happen if the encryption key has changed.',
      });
    }
    const cashierLogin = payment.checkbox_cashier_login;

    // Convert amount to kopiyky (Checkbox uses kopiyky for amounts)
    const amountInKopiyky = uahToKopiyky(parseFloat(payment.amount));

    // Prepare company and payment info for product title generation
    const companyInfo = {
      id: payment.company_id,
      name: payment.company_name,
    };

    const paymentInfo = {
      id: payment.id,
      description: payment.description,
      amount: payment.amount,
      sender_name: payment.sender_name,
    };

    // Prepare receipt data
    const receiptData: CheckboxCreateReceiptRequest = {
      goods: [
        {
          good: {
            code: getProductCode(companyInfo, paymentInfo),
            name: getProductTitle(companyInfo, paymentInfo),
            price: amountInKopiyky,
          },
          quantity: 1000, // 1000 = 1 unit (Checkbox uses milliliters/milligrams)
        },
      ],
      payments: [
        {
          type: 'CASHLESS', // Assuming all payments from PrivatBank are cashless
          value: amountInKopiyky,
        },
      ],
      cashier_name: payment.company_name,
      header: `Платіж від: ${payment.sender_name}`,
      footer: 'Дякуємо за співпрацю!',
    };

    logger.debug('Receipt data prepared', { paymentId, amountInKopiyky });

    // Issue receipt via Checkbox API
    let checkboxReceipt;
    try {
      logger.externalApiCall('Checkbox', 'Issue Receipt', { paymentId });
      checkboxReceipt = await checkboxIssueReceipt(
        cashierLogin,
        cashierPin,
        licenseKey,
        receiptData
      );
    } catch (apiError: any) {
      logger.externalApiError('Checkbox', apiError, { paymentId });
      throw errors.serviceUnavailable('Checkbox');
    }

    logger.info('Checkbox receipt created successfully', {
      paymentId,
      checkboxReceiptId: checkboxReceipt.id,
      fiscalCode: checkboxReceipt.fiscal_code
    });

    // Store receipt in database
    logger.dbQuery('INSERT receipt and UPDATE payment', [paymentId]);
    const receiptInsertResult = await sql`
      INSERT INTO receipts (
        company_id,
        payment_id,
        checkbox_receipt_id,
        fiscal_code,
        amount,
        receipt_url,
        pdf_url,
        status,
        issued_at
      )
      VALUES (
        ${payment.company_id},
        ${paymentId},
        ${checkboxReceipt.id},
        ${checkboxReceipt.fiscal_code || null},
        ${payment.amount},
        ${checkboxReceipt.receipt_url || null},
        ${checkboxReceipt.pdf_url || null},
        ${checkboxReceipt.status},
        ${checkboxReceipt.created_at}
      )
      RETURNING id
    `;

    const receiptId = receiptInsertResult.rows[0].id;

    // Update payment to mark receipt as issued
    await sql`
      UPDATE payments
      SET receipt_issued = true
      WHERE id = ${paymentId}
    `;

    logger.info('Receipt saved to database', { receiptId, paymentId });

    // Return success response
    logger.apiResponse(context.method, context.path, 200);
    return NextResponse.json({
      success: true,
      message: 'Receipt created successfully',
      receipt: {
        id: receiptId,
        checkbox_receipt_id: checkboxReceipt.id,
        fiscal_code: checkboxReceipt.fiscal_code,
        receipt_url: checkboxReceipt.receipt_url,
        pdf_url: checkboxReceipt.pdf_url,
        status: checkboxReceipt.status,
        issued_at: checkboxReceipt.created_at,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        sender_name: payment.sender_name,
        description: payment.description,
      },
    });
  } catch (error) {
    return handleApiError(error, context);
  }
}
