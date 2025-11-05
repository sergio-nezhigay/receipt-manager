/**
 * Checkbox API Client
 *
 * Documentation: https://wiki.checkbox.ua/
 * API Base URL: https://api.checkbox.ua/api/v1
 * Receipt API: https://api.checkbox.in.ua/api/v1 (Note: different domain for receipt creation)
 *
 * Flow:
 * 1. Sign in to get access token
 * 2. Open shift (required before creating receipts)
 * 3. Create receipts
 * 4. Close shift at end of day
 */

const CHECKBOX_API_BASE = 'https://api.checkbox.ua/api/v1';
const CHECKBOX_RECEIPT_API_BASE = 'https://api.checkbox.in.ua/api/v1';

// ===== Authentication Types =====

export interface CheckboxSignInRequest {
  login: string;
  password: string;
}

export interface CheckboxSignInResponse {
  type: 'bearer';
  token_type: 'bearer';
  access_token: string;
}

// ===== Shift Types =====

export interface CheckboxShift {
  id: string;
  serial: number;
  status: 'OPENED' | 'CLOSED';
  z_report_id?: string;
  opened_at: string;
  closed_at?: string;
  initial_transaction_id?: string;
  closing_transaction_id?: string;
  fiscal_code?: string;
  fiscal_date?: string;
  balance?: {
    initial: number;
    balance: number;
    cash_sales: number;
    card_sales: number;
  };
}

export interface CheckboxShiftResponse {
  id: string;
  status: string;
  opened_at: string;
  closed_at?: string;
}

// ===== Receipt Types =====

export interface CheckboxReceiptGood {
  good: {
    code: string;          // Product code
    name: string;          // Product name
    price: number;         // Price in kopiyky (e.g., 5000 = 50.00 UAH)
  };
  quantity: number;        // Quantity in milliliters/milligrams (e.g., 1000 = 1 unit)
}

export interface CheckboxReceiptPayment {
  type: 'CASH' | 'CASHLESS' | 'CARD';
  value: number;           // Amount in kopiyky
}

export interface CheckboxCreateReceiptRequest {
  goods: CheckboxReceiptGood[];
  payments: CheckboxReceiptPayment[];
  cashier_name?: string;
  header?: string;
  footer?: string;
}

export interface CheckboxReceiptResponse {
  id: string;
  type: 'SELL' | 'RETURN';
  transaction: {
    id: string;
    serial: number;
  };
  status: 'DONE' | 'PENDING' | 'ERROR';
  fiscal_code?: string;
  fiscal_date?: string;
  delivered_at?: string;
  receipt_url?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

// ===== API Client =====

/**
 * Sign in to Checkbox and get access token
 */
export async function checkboxSignIn(
  login: string,
  password: string
): Promise<string> {
  console.log(`Signing in to Checkbox as: ${login}`);

  try {
    const response = await fetch(`${CHECKBOX_API_BASE}/cashier/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login,
        password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Checkbox sign in error:', response.status, errorText);
      throw new Error(`Checkbox sign in failed: ${response.status} ${response.statusText}`);
    }

    const data: CheckboxSignInResponse = await response.json();
    console.log('Successfully signed in to Checkbox');
    return data.access_token;
  } catch (error) {
    console.error('Error signing in to Checkbox:', error);
    throw error;
  }
}

/**
 * Open a new shift (required before creating receipts)
 */
export async function checkboxOpenShift(
  accessToken: string,
  licenseKey: string
): Promise<CheckboxShiftResponse> {
  console.log('Opening Checkbox shift...');

  try {
    const response = await fetch(`${CHECKBOX_API_BASE}/shifts`, {
      method: 'POST',
      headers: {
        'X-License-Key': licenseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Checkbox open shift error:', response.status, errorText);
      throw new Error(`Failed to open shift: ${response.status} ${response.statusText}`);
    }

    const data: CheckboxShiftResponse = await response.json();
    console.log('Shift opened successfully:', data.id);
    return data;
  } catch (error) {
    console.error('Error opening Checkbox shift:', error);
    throw error;
  }
}

/**
 * Get current active shift
 */
export async function checkboxGetShift(
  accessToken: string
): Promise<CheckboxShift | null> {
  console.log('Getting current Checkbox shift...');

  try {
    const response = await fetch(`${CHECKBOX_API_BASE}/cashier/shift`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('No active shift found');
        return null;
      }
      const errorText = await response.text();
      console.error('Checkbox get shift error:', response.status, errorText);
      throw new Error(`Failed to get shift: ${response.status} ${response.statusText}`);
    }

    const data: CheckboxShift = await response.json();
    console.log('Current shift:', data.id, 'Status:', data.status);
    return data;
  } catch (error) {
    console.error('Error getting Checkbox shift:', error);
    throw error;
  }
}

/**
 * Create a receipt (sell transaction)
 */
export async function checkboxCreateReceipt(
  accessToken: string,
  licenseKey: string,
  receiptData: CheckboxCreateReceiptRequest
): Promise<CheckboxReceiptResponse> {
  console.log('Creating Checkbox receipt...');

  try {
    // Note: Using different domain for receipt creation
    const response = await fetch(`${CHECKBOX_RECEIPT_API_BASE}/receipts/sell`, {
      method: 'POST',
      headers: {
        'X-License-Key': licenseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Checkbox create receipt error:', response.status, errorText);
      throw new Error(`Failed to create receipt: ${response.status} ${response.statusText}`);
    }

    const data: CheckboxReceiptResponse = await response.json();
    console.log('Receipt created successfully:', data.id);
    return data;
  } catch (error) {
    console.error('Error creating Checkbox receipt:', error);
    throw error;
  }
}

/**
 * Helper: Convert UAH amount to kopiyky
 * Example: 50.00 UAH -> 5000 kopiyky
 */
export function uahToKopiyky(uah: number): number {
  return Math.round(uah * 100);
}

/**
 * Helper: Convert kopiyky to UAH
 * Example: 5000 kopiyky -> 50.00 UAH
 */
export function kopikyToUah(kopiyky: number): number {
  return kopiyky / 100;
}

/**
 * Full workflow: Authenticate, ensure shift is open, create receipt
 */
export async function checkboxIssueReceipt(
  login: string,
  password: string,
  licenseKey: string,
  receiptData: CheckboxCreateReceiptRequest
): Promise<CheckboxReceiptResponse> {
  console.log('Starting Checkbox receipt issuance workflow...');

  // Step 1: Sign in
  const accessToken = await checkboxSignIn(login, password);

  // Step 2: Check if shift is open
  const currentShift = await checkboxGetShift(accessToken);

  if (!currentShift || currentShift.status !== 'OPENED') {
    console.log('No active shift found, opening new shift...');
    await checkboxOpenShift(accessToken, licenseKey);
  } else {
    console.log('Using existing active shift:', currentShift.id);
  }

  // Step 3: Create receipt
  const receipt = await checkboxCreateReceipt(accessToken, licenseKey, receiptData);

  console.log('Receipt issuance complete:', receipt.id);
  return receipt;
}
