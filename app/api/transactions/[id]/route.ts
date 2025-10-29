import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// GET - Read single transaction
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Fetching transaction with id: ${params.id}`);

    const { rows } = await sql`
      SELECT * FROM transactions WHERE id = ${parseInt(params.id)}
    `;

    if (rows.length === 0) {
      console.log('Transaction not found');
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    console.log('Transaction found:', rows[0]);
    return NextResponse.json({ transaction: rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Update transaction
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { amount, description, date, category, type } = body;

    console.log(`Updating transaction ${params.id}:`, body);

    const result = await sql`
      UPDATE transactions
      SET
        amount = COALESCE(${amount ? parseFloat(amount) : null}, amount),
        description = COALESCE(${description}, description),
        date = COALESCE(${date}, date),
        category = COALESCE(${category}, category),
        type = COALESCE(${type}, type),
        updated_at = NOW()
      WHERE id = ${parseInt(params.id)}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      console.log('Transaction not found');
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    console.log('Transaction updated successfully:', result.rows[0]);
    return NextResponse.json({
      transaction: result.rows[0],
      message: 'Transaction updated successfully'
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Delete transaction
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Deleting transaction with id: ${params.id}`);

    const result = await sql`
      DELETE FROM transactions WHERE id = ${parseInt(params.id)}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      console.log('Transaction not found');
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    console.log('Transaction deleted successfully:', result.rows[0]);
    return NextResponse.json({
      message: 'Transaction deleted successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction', details: String(error) },
      { status: 500 }
    );
  }
}
