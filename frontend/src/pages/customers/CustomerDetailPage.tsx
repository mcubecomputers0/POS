import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, MapPin, FileText, CreditCard } from 'lucide-react';
import { customerApi } from '../../api';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
    enabled: !!id,
  });

  const { data: ledgerData } = useQuery({
    queryKey: ['customer-ledger', id],
    queryFn: () => customerApi.getLedger(id!, { limit: 20 }),
    enabled: !!id,
  });

  const customer = data?.data;
  const ledger = ledgerData?.data ?? [];

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!customer) return <div>Customer not found</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-2)' }} onClick={() => navigate('/customers')}>
            <ArrowLeft size={14} /> Back to Customers
          </button>
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-subtitle">
            <span className={`badge ${customer.customerType === 'B2B' ? 'badge-info' : 'badge-default'}`}>{customer.customerType}</span>
            {customer.gstin && <span style={{ marginLeft: 8 }}>GSTIN: {customer.gstin}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Info Card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Customer Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {customer.phone && <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
              <Phone size={14} style={{ color: 'var(--color-text-dim)' }} /> {customer.phone}
            </div>}
            {customer.email && <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
              <Mail size={14} style={{ color: 'var(--color-text-dim)' }} /> {customer.email}
            </div>}
            {customer.city && <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', fontSize: 'var(--text-sm)' }}>
              <MapPin size={14} style={{ color: 'var(--color-text-dim)', marginTop: 2 }} />
              <span>{[customer.addressLine1, customer.city, customer.state, customer.pinCode].filter(Boolean).join(', ')}</span>
            </div>}
          </div>

          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', marginBottom: 4 }}>Outstanding Amount</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: customer.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                ₹{(customer.outstandingAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', marginBottom: 4 }}>Total Invoices</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{customer.invoiceCount ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Ledger */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Transactions</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {ledger.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No transactions yet</div>
            ) : ledger.map((entry: any) => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)', fontSize: 'var(--text-sm)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{entry.reference || entry.type}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{new Date(entry.date).toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ fontWeight: 600, color: entry.type === 'debit' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {entry.type === 'debit' ? '+' : '-'}₹{(entry.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
