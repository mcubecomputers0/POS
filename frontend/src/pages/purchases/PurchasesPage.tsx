import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { purchaseApi } from '../../api';

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search],
    queryFn: () => purchaseApi.list({ page, limit: 20, search }),
  });
  const purchases = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} purchases</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}><Plus size={16} /> New Purchase</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input">
          <Search size={16} style={{ color: 'var(--color-text-dim)' }} />
          <input placeholder="Search purchase orders..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Purchase No.</th><th>Supplier</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>)
              ) : purchases.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><ShoppingBag size={32} /></div>
                    <div className="empty-state-title">No purchases yet</div>
                  </div>
                </td></tr>
              ) : purchases.map((p: any) => (
                <tr key={p.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{p.purchaseNumber}</span></td>
                  <td>{p.supplier?.name ?? '—'}</td>
                  <td>{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'right' }}>₹{(p.grandTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${p.status === 'received' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
