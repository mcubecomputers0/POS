import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { quotationApi } from '../../api';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['quotations', page, search], queryFn: () => quotationApi.list({ page, limit: 20, search }) });
  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Quotations</h1><p className="page-subtitle">{pagination?.total ?? 0} quotations</p></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => navigate('/quotations/new')}><Plus size={16} /> New Quotation</button></div>
      </div>
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input"><Search size={16} style={{ color: 'var(--color-text-dim)' }} /><input placeholder="Search quotations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Quotation No.</th><th>Customer</th><th>Date</th><th>Valid Until</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><ClipboardList size={32} /></div><div className="empty-state-title">No quotations yet</div></div></td></tr>
              : items.map((q: any) => (
                <tr key={q.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{q.quotationNumber}</span></td>
                  <td>{q.customer?.name ?? q.customerName ?? 'Walk-in'}</td>
                  <td>{new Date(q.quotationDate).toLocaleDateString('en-IN')}</td>
                  <td>{q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : '—'}</td>
                  <td style={{ textAlign: 'right' }}>₹{(q.grandTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${q.status === 'accepted' ? 'badge-success' : q.status === 'sent' ? 'badge-info' : 'badge-default'}`}>{q.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
