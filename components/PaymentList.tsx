'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Payment {
  id: number;
  company_id: number;
  external_id: string;
  amount: string;
  currency: string;
  description: string;
  sender_account: string;
  sender_name: string;
  sender_tax_id: string | null;
  document_number: string | null;
  payment_date: string;
  status: string;
  receipt_issued: boolean;
  receipt_id: number | null;
  created_at: string;
  checkbox_receipt_id: string | null;
  fiscal_number: string | null;
  pdf_url: string | null;
}

interface PaymentListProps {
  companyId: number;
}

export default function PaymentList({ companyId }: PaymentListProps) {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'issued'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Summary stats
  const [stats, setStats] = useState({
    total_payments: 0,
    pending_receipts: 0,
    issued_receipts: 0,
    total_amount: 0,
    pending_amount: 0,
  });

  useEffect(() => {
    if (companyId) {
      fetchPayments();
    }
  }, [companyId, startDate, endDate, statusFilter, searchQuery, offset]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Build query params
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        limit: limit.toString(),
        offset: offset.toString(),
        status: statusFilter,
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/payments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();

      setPayments(data.payments || []);
      setTotalCount(data.pagination.total);
      setHasMore(data.pagination.hasMore);
      setStats(data.summary);

      console.log(`Loaded ${data.payments.length} payments`);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setSearchQuery('');
    setOffset(0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: string, currency: string) => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  };

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px',
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Всього платежів</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>{stats.total_payments}</div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Очікують чек</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.pending_receipts}</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
            {formatAmount(stats.pending_amount.toString(), 'UAH')}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Чеки видано</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.issued_receipts}</div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Загальна сума</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>
            {formatAmount(stats.total_amount.toString(), 'UAH')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        marginBottom: '20px',
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Фільтри</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '15px',
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Дата від:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setOffset(0);
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Дата до:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setOffset(0);
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Статус:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'pending' | 'issued');
                setOffset(0);
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px',
              }}
            >
              <option value="all">Всі</option>
              <option value="pending">Очікують чек</option>
              <option value="issued">Чек видано</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Пошук:
            </label>
            <input
              type="text"
              placeholder="Пошук по відправнику..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleReset}
          style={{
            padding: '8px 16px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Скинути фільтри
        </button>
      </div>

      {/* Payments List */}
      {error && (
        <div style={{
          padding: '15px',
          background: '#fee',
          color: '#c33',
          borderRadius: '5px',
          marginBottom: '20px',
        }}>
          <strong>Помилка:</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Завантаження платежів...
        </div>
      ) : payments.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center',
          color: '#666',
        }}>
          <p>Платежів не знайдено</p>
          {(startDate || endDate || searchQuery || statusFilter !== 'all') && (
            <p style={{ fontSize: '14px', marginTop: '10px' }}>
              Спробуйте змінити фільтри або скинути їх
            </p>
          )}
        </div>
      ) : (
        <>
          <div style={{
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Дата</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Відправник</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Опис</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>Сума</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: payment.receipt_issued ? '#f0fdf4' : 'white',
                    }}
                  >
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {formatDate(payment.payment_date)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <div style={{ fontWeight: '500' }}>{payment.sender_name}</div>
                      {payment.sender_tax_id && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          ЄДРПОУ: {payment.sender_tax_id}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', maxWidth: '300px' }}>
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {payment.description}
                      </div>
                      {payment.document_number && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Док: {payment.document_number}
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      textAlign: 'right',
                      color: '#10b981',
                    }}>
                      {formatAmount(payment.amount, payment.currency)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {payment.receipt_issued ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}>
                          ✓ Чек видано
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}>
                          ⏳ Очікує
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(offset > 0 || hasMore) && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
              padding: '15px',
              background: 'white',
              borderRadius: '10px',
            }}>
              <div style={{ fontSize: '14px', color: '#666' }}>
                Показано {offset + 1}-{Math.min(offset + limit, totalCount)} з {totalCount}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  style={{
                    padding: '8px 16px',
                    background: offset === 0 ? '#e5e7eb' : '#667eea',
                    color: offset === 0 ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: offset === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ← Попередня
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasMore}
                  style={{
                    padding: '8px 16px',
                    background: !hasMore ? '#e5e7eb' : '#667eea',
                    color: !hasMore ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: !hasMore ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Наступна →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
