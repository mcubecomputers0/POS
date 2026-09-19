import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Wallet } from 'lucide-react';
import { paymentApi } from '../../api';

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['payments', page, search], queryFn: () => paymentApi.list({ page, limit: 20, search }) });
  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Payments</h1><p className="page-subtitle">{pagination?.total ?? 0} payments recorded</p></div>
        <div className="page-actions"><button className="btn btn-primary"><Plus size={16} /> Record Payment</button></div>
      </div>
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input"><Search size={16} style={{ color: 'var(--color-text-dim)' }} /><input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Reference</th><th>Party</th><th>Type</th><th>Date</th><th>Method</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><Wallet size={32} /></div><div className="empty-state-title">No payments recorded</div></div></td></tr>
              : items.map((p: any) => (
                <tr key={p.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{p.reference || p.id.slice(0, 8)}</span></td>
                  <td>{p.customer?.name ?? p.supplier?.name ?? '—'}</td>
                  <td><span className={`badge ${p.paymentType === 'received' ? 'badge-success' : 'badge-danger'}`}>{p.paymentType}</span></td>
                  <td>{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.method?.replace('_', ' ')}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: p.paymentType === 'received' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {p.paymentType === 'received' ? '+' : '-'}₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td><span className={`badge ${p.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
