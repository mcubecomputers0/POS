import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, RotateCcw } from 'lucide-react';
import { salesReturnApi } from '../../api';

export default function SalesReturnsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['sales-returns', page, search], queryFn: () => salesReturnApi.list({ page, limit: 20, search }) });
  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Sales Returns</h1><p className="page-subtitle">{pagination?.total ?? 0} returns</p></div>
        <div className="page-actions"><button className="btn btn-primary"><Plus size={16} /> New Return</button></div>
      </div>
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input"><Search size={16} style={{ color: 'var(--color-text-dim)' }} /><input placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Return No.</th><th>Original Invoice</th><th>Customer</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><RotateCcw size={32} /></div><div className="empty-state-title">No sales returns yet</div></div></td></tr>
              : items.map((r: any) => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{r.returnNumber}</span></td>
                  <td>{r.invoice?.invoiceNumber ?? '—'}</td>
                  <td>{r.customer?.name ?? '—'}</td>
                  <td>{new Date(r.returnDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>₹{(r.grandTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${r.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
