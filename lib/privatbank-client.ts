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
 *
 * Note: PrivatBank API returns data in Windows-1251 encoding, so we need to convert it to UTF-8
 */

import * as iconv from 'iconv-lite';

// Base API URL - Update this with the actual PrivatBank API endpoint
const PRIVATBANK_API_BASE_URL = 'https://acp.privatbank.ua/api';

export interface PrivatBankTransaction {
  // Transaction identification
  ID: string;                       // Transaction ID
  TECHNICAL_TRANSACTION_ID: string; // Unique technical ID
  NUM_DOC: string;                  // Document number
  DOC_TYP: string;                  // Document type
  REF: string;                      // Reference
  REFN: string;                     // Reference type

  // Date and time
  DAT_KL: string;                   // Transaction date (client)
  DAT_OD: string;                   // Transaction date (processing)
  TIM_P: string;                    // Transaction time
  DATE_TIME_DAT_OD_TIM_P: string;   // Combined date-time

  // Account details (our account)
  AUT_MY_CRF: string;               // Our company tax ID
  AUT_MY_MFO: string;               // Our bank MFO code
  AUT_MY_ACC: string;               // Our account number
  AUT_MY_NAM: string;               // Our company name
  AUT_MY_MFO_NAME: string;          // Our bank name
  AUT_MY_MFO_CITY: string;          // Our bank city

  // Counterparty details (sender/receiver)
  AUT_CNTR_CRF: string;             // Counterparty tax ID
  AUT_CNTR_MFO: string;             // Counterparty bank MFO
  AUT_CNTR_ACC: string;             // Counterparty account number
  AUT_CNTR_NAM: string;             // Counterparty name
  AUT_CNTR_MFO_NAME: string;        // Counterparty bank name
  AUT_CNTR_MFO_CITY: string;        // Counterparty bank city

  // Payment details
  CCY: string;                      // Currency code (UAH, USD, EUR)
  SUM: string;                      // Amount (debit)
  SUM_E: string;                    // Amount (credit)
  OSND: string;                     // Payment description/purpose
  TRANTYPE: string;                 // Transaction type (C=credit, D=debit)

  // Status flags
  FL_REAL: string;                  // Real transaction flag
  PR_PR: string;                    // Income (r) or expense
  DLR: string | null;               // Additional field
  UETR?: string;                    // Optional UETR
  ULTMT?: string;                   // Optional ULTMT
}

export interface PrivatBankStatementResponse {
  status: string;               // Response status (SUCCESS, ERROR)
  type: string;                 // Response type (transactions)
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
  const { merchantId, token, startDate, endDate } = options;

  // Format dates as required by PrivatBank API (DD-MM-YYYY)
  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  console.log(`Fetching PrivatBank payments from ${startDateStr} to ${endDateStr}`);

  try {
    // Build request URL with startDate query param
    const url = `${PRIVATBANK_API_BASE_URL}/statements/transactions?startDate=${startDateStr}`;

    console.log('PrivatBank API request:', { url, merchantId, startDate: startDateStr, endDate: endDateStr });

    // Use GET method with authentication and params in headers
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Id': merchantId,
        'Token': token,
        'startDate': startDateStr,
        'endDate': endDateStr,
        'limit': '100',
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8',
      },
    });

    if (!response.ok) {
      const errorBuffer = await response.arrayBuffer();
      const errorText = iconv.decode(Buffer.from(errorBuffer), 'win1251');
      console.error('PrivatBank API error:', response.status, errorText);
      throw new Error(`PrivatBank API error: ${response.status} ${response.statusText}`);
    }

    // PrivatBank returns data in Windows-1251 encoding, we need to convert it to UTF-8
    const buffer = await response.arrayBuffer();
    const decodedText = iconv.decode(Buffer.from(buffer), 'win1251');

    console.log('Decoded response (first 500 chars):', decodedText.substring(0, 500));

    const data: PrivatBankStatementResponse = JSON.parse(decodedText);

    console.log(`PrivatBank API response status: ${data.status}`);
    console.log(`PrivatBank API response: ${data.transactions?.length || 0} transactions`);

    if (data.status !== 'SUCCESS') {
      throw new Error(`PrivatBank API returned status: ${data.status}`);
    }

    // Filter for incoming payments only (TRANTYPE = 'C' for Credit)
    const incomingPayments = (data.transactions || []).filter(
      (tx) => tx.TRANTYPE === 'C' && parseFloat(tx.SUM_E || '0') > 0
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
    external_id: tx.TECHNICAL_TRANSACTION_ID || `PB_${tx.ID}`,
    amount: parseFloat(tx.SUM_E || tx.SUM || '0'),
    sender_name: tx.AUT_CNTR_NAM || 'Unknown',
    sender_account: tx.AUT_CNTR_ACC || '',
    sender_tax_id: tx.AUT_CNTR_CRF || '',
    description: tx.OSND || '',
    payment_date: parseDateTimeFromPrivatBank(tx.DATE_TIME_DAT_OD_TIM_P || `${tx.DAT_OD} ${tx.TIM_P}`),
    currency: tx.CCY || 'UAH',
    document_number: tx.NUM_DOC || '',
  };
}

/**
 * Parse PrivatBank date-time format (DD.MM.YYYY HH:MM:SS) to ISO string
 */
function parseDateTimeFromPrivatBank(dateTimeStr: string): string {
  try {
    // Parse "DD.MM.YYYY HH:MM:SS" format
    const [datePart, timePart] = dateTimeStr.split(' ');
    const [day, month, year] = datePart.split('.').map(Number);

    let hours = 0, minutes = 0, seconds = 0;
    if (timePart) {
      [hours, minutes, seconds] = timePart.split(':').map(Number);
    }

    const date = new Date(year, month - 1, day, hours, minutes, seconds || 0);
    return date.toISOString();
  } catch (error) {
    console.error('Error parsing PrivatBank date-time:', dateTimeStr, error);
    return new Date().toISOString();
  }
}
