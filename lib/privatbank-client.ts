/**
 * PrivatBank AutoClient API Client
 *
 * Documentation: https://api.privatbank.ua/
 * Official docs: https://docs.google.com/document/d/e/2PACX-1vTtKvGa3P4E-lDqLg3bHRF6Wi9S7GIjSMFEFxII5qQZBGxuTXs25hQNiUU1hMZQhOyx6BNvIZ1bVKSr/pub
 *
 * To activate AutoClient:
 * 1. Go to "Privat24 for business" → "Accounting and Reports" → "Integration (AutoClient)"
 * 2. Click "Activate Application" → "Integration Module"
 * 3. Get your Merchant ID and API Token
 */

// Base API URL - Update this with the actual PrivatBank API endpoint
const PRIVATBANK_API_BASE_URL = 'https://acp.privatbank.ua/api';

export interface PrivatBankTransaction {
  // Transaction identification
  NUM_DOC: string;              // Document number
  DOC_TYP: string;              // Document type

  // Date and time
  DAT_KL: string;               // Transaction date (client)
  DAT_OD: string;               // Transaction date (processing)
  TIM_P: string;                // Transaction time

  // Account details (our account)
  AUT_MY_CRF: string;           // Our company tax ID
  AUT_MY_MFO: string;           // Our bank MFO code
  AUT_MY_ACC: string;           // Our account number
  AUT_MY_NAM: string;           // Our company name

  // Counterparty details (sender/receiver)
  AUT_CNTR_CRF: string;         // Counterparty tax ID
  AUT_CNTR_MFO: string;         // Counterparty bank MFO
  AUT_CNTR_ACC: string;         // Counterparty account number
  AUT_CNTR_NAM: string;         // Counterparty name

  // Payment details
  CCY: string;                  // Currency code (UAH, USD, EUR)
  SUM: string;                  // Amount (debit)
  SUM_E: string;                // Amount (credit)
  OSND: string;                 // Payment description/purpose

  // Status flags
  FL_REAL: string;              // Real transaction flag
  PR_PR: string;                // Income (1) or expense (0)
}

export interface PrivatBankStatementResponse {
  code: string;                 // Response code
  status: string;               // Response status
  type: string;                 // Response type
  exist_next_page: boolean;     // Pagination flag
  next_page_id?: string;        // Next page ID if exists
  transactions: PrivatBankTransaction[];
}

export interface FetchPaymentsOptions {
  merchantId: string;           // PrivatBank merchant ID
  token: string;                // API token
  startDate: Date;              // Start date for statement
  endDate: Date;                // End date for statement
  account?: string;             // Optional: specific account number
}

/**
 * Fetch payment transactions from PrivatBank API
 */
export async function fetchPrivatBankPayments(
  options: FetchPaymentsOptions
): Promise<PrivatBankTransaction[]> {
  const { merchantId, token, startDate, endDate, account } = options;

  // Format dates as required by PrivatBank API (DD.MM.YYYY)
  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  console.log(`Fetching PrivatBank payments from ${startDateStr} to ${endDateStr}`);

  try {
    // Build request URL
    // NOTE: This is a placeholder endpoint structure based on common patterns
    // You'll need to replace this with the actual endpoint from PrivatBank documentation
    const url = `${PRIVATBANK_API_BASE_URL}/statement`;

    const requestBody = {
      id: merchantId,
      token: token,
      startDate: startDateStr,
      endDate: endDateStr,
      ...(account && { account }), // Include account if provided
    };

    console.log('PrivatBank API request:', { url, merchantId, startDate: startDateStr, endDate: endDateStr });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PrivatBank API error:', response.status, errorText);
      throw new Error(`PrivatBank API error: ${response.status} ${response.statusText}`);
    }

    const data: PrivatBankStatementResponse = await response.json();

    console.log(`PrivatBank API response: ${data.transactions?.length || 0} transactions`);

    // Filter for incoming payments only (PR_PR = '1')
    const incomingPayments = (data.transactions || []).filter(
      (tx) => tx.PR_PR === '1' && parseFloat(tx.SUM_E || '0') > 0
    );

    console.log(`Filtered ${incomingPayments.length} incoming payments`);

    return incomingPayments;
  } catch (error) {
    console.error('Error fetching PrivatBank payments:', error);
    throw error;
  }
}

/**
 * Parse PrivatBank transaction to our payment format
 */
export function parsePrivatBankTransaction(tx: PrivatBankTransaction) {
  return {
    external_id: `PB_${tx.NUM_DOC}_${tx.DAT_OD}`,
    amount: parseFloat(tx.SUM_E || tx.SUM || '0'),
    sender_name: tx.AUT_CNTR_NAM || 'Unknown',
    sender_account: tx.AUT_CNTR_ACC || '',
    sender_tax_id: tx.AUT_CNTR_CRF || '',
    description: tx.OSND || '',
    payment_date: parseDateFromPrivatBank(tx.DAT_OD, tx.TIM_P),
    currency: tx.CCY || 'UAH',
    document_number: tx.NUM_DOC || '',
  };
}

/**
 * Parse PrivatBank date format (DD.MM.YYYY) and time (HH:MM:SS) to ISO string
 */
function parseDateFromPrivatBank(dateStr: string, timeStr?: string): string {
  try {
    // Parse DD.MM.YYYY format
    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);

    if (timeStr) {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);
      date.setHours(hours, minutes, seconds || 0);
    }

    return date.toISOString();
  } catch (error) {
    console.error('Error parsing PrivatBank date:', dateStr, timeStr, error);
    return new Date().toISOString();
  }
}
