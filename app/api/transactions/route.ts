import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// GET - List all transactions
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const category = searchParams.get('category');

    console.log(`Fetching transactions (limit: ${limit}, category: ${category || 'all'})`);

    let query;
    if (category) {
      query = sql`
        SELECT * FROM transactions
        WHERE category = ${category}
        ORDER BY date DESC
        LIMIT ${parseInt(limit)}
      `;
    } else {
      query = sql`
        SELECT * FROM transactions
        ORDER BY date DESC
        LIMIT ${parseInt(limit)}
      `;
    }

    const { rows } = await query;

    // Calculate balance
    const balance = rows.reduce((acc, tx) => {
      return tx.type === 'credit'
        ? acc + parseFloat(tx.amount)
        : acc - parseFloat(tx.amount);
    }, 0);

    console.log(`Fetched ${rows.length} transactions. Balance: $${balance.toFixed(2)}`);

    return NextResponse.json({
      transactions: rows,
      count: rows.length,
      balance: balance.toFixed(2)
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create new transaction
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, description, date, category, type } = body;

    console.log('Creating transaction:', { amount, description, date, category, type });

    // Validation
    if (!amount || !description || !date || !type) {
      console.error('Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: amount, description, date, type' },
        { status: 400 }
      );
    }

    if (!['debit', 'credit'].includes(type)) {
      console.error('Invalid transaction type');
      return NextResponse.json(
        { error: 'Type must be either "debit" or "credit"' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO transactions (amount, description, date, category, type)
      VALUES (
        ${parseFloat(amount)},
        ${description},
        ${date},
        ${category || 'uncategorized'},
        ${type}
      )
      RETURNING *
    `;

    console.log('Transaction created successfully:', result.rows[0]);

    return NextResponse.json({
      transaction: result.rows[0],
      message: 'Transaction created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction', details: String(error) },
      { status: 500 }
    );
  }
}
