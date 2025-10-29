'use client'

import { useState, useEffect } from 'react'

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  category: string;
  type: 'debit' | 'credit';
  created_at: string;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    type: 'debit' as 'debit' | 'credit'
  });

  useEffect(() => {
    console.log('Hello Vercel MCP! Page loaded successfully.');
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      console.log('Fetching transactions...');
      const res = await fetch('/api/transactions');
      const data = await res.json();

      if (res.ok) {
        setTransactions(data.transactions || []);
        setBalance(data.balance || '0.00');
        console.log(`Loaded ${data.count} transactions. Balance: $${data.balance}`);
      } else {
        console.error('Failed to fetch transactions:', data.error);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Submitting transaction:', formData);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });

      const data = await res.json();

      if (res.ok) {
        console.log('Transaction created:', data.transaction);
        fetchTransactions();
        setFormData({
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
          category: '',
          type: 'debit'
        });
      } else {
        console.error('Failed to create transaction:', data.error);
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Error creating transaction. Check console for details.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;

    console.log(`Deleting transaction ${id}...`);

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (res.ok) {
        console.log('Transaction deleted:', data.transaction);
        fetchTransactions();
      } else {
        console.error('Failed to delete transaction:', data.error);
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error deleting transaction. Check console for details.');
    }
  };

  return (
    <main className="container">
      <div className="content">
        <h1>Hello Vercel MCP!</h1>
        <p>This is a simple test project deployed via Vercel MCP.</p>
        <div className="info">
          <h2>Project Info</h2>
          <ul>
            <li>Framework: Next.js 14</li>
            <li>Deployed using: Vercel MCP</li>
            <li>Database: Vercel Postgres</li>
            <li>Status: ✅ Live and working!</li>
          </ul>
        </div>
      </div>

      <div className="content transactions-section">
        <h2>Bank Transactions</h2>
        <div className="balance-display">
          <span className="balance-label">Current Balance:</span>
          <span className={`balance-amount ${parseFloat(balance) >= 0 ? 'positive' : 'negative'}`}>
            ${balance}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="transaction-form">
          <h3>Add Transaction</h3>
          <div className="form-row">
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              required
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value as 'debit' | 'credit'})}
            >
              <option value="debit">Debit (-)</option>
              <option value="credit">Credit (+)</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
          />
          <div className="form-row">
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
            <input
              type="text"
              placeholder="Category (optional)"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            />
          </div>
          <button type="submit">Add Transaction</button>
        </form>

        <div className="transactions-list">
          <h3>Recent Transactions ({transactions.length})</h3>
          {loading ? (
            <p className="loading">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="empty">No transactions yet. Add one above!</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className={`transaction-item ${tx.type}`}>
                <div className="transaction-main">
                  <div className="transaction-info">
                    <strong>{tx.description}</strong>
                    <span className="transaction-category">{tx.category}</span>
                  </div>
                  <div className="transaction-amount">
                    <span className={`amount ${tx.type}`}>
                      {tx.type === 'credit' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="transaction-meta">
                  <span className="transaction-date">
                    {new Date(tx.date).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
