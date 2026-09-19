import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, FileText, Printer, Download } from 'lucide-react';
import { invoiceApi } from '../../api';
import { exportInvoices } from '../../utils/excelExport';
import toast from 'react-hot-toast';

const STATUS_BADGES: Record<string, string> = {
  draft: 'badge-default',
  pending: 'badge-warning',
  paid: 'badge-success',
  partial: 'badge-info',
  overdue: 'badge-danger',
  cancelled: 'badge-danger',
};

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, status],
    queryFn: () => invoiceApi.list({ page, limit: 20, search, status: status || undefined }),
  });

  const invoices = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} invoices</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={async () => {
            try {
              const all = await invoiceApi.list({ limit: 1000 });
              await exportInvoices(all.data, 'Invoices.xlsx');
            } catch { toast.error('Export failed'); }
          }}><Download size={16} /> Export Excel</button>
          <Link to="/pos" className="btn btn-primary"><Plus size={16} /> New Invoice</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
            <input placeholder="Search by invoice no., customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>)
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FileText size={32} /></div>
                    <div className="empty-state-title">No invoices found</div>
                    <Link to="/pos" className="btn btn-primary"><Plus size={14} /> Create First Invoice</Link>
                  </div>
                </td></tr>
              ) : invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{inv.invoiceNumber}</span></td>
                  <td>
                    <div>
                      {inv.customer?.name ||
                        inv.customerName ||
                        (inv.notes?.match(/Walk-in:\s*([^•\n\r]+)/i)?.[1]?.trim()) ||
                        'Walk-in Customer'}
                    </div>
                    {inv.customer?.gstin && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{inv.customer.gstin}</div>}
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>
                    {inv.invoiceDate && !isNaN(new Date(inv.invoiceDate).getTime()) ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)', color: inv.status === 'overdue' ? 'var(--color-danger)' : 'inherit' }}>
                    {inv.dueDate && !isNaN(new Date(inv.dueDate).getTime()) ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    ₹{((inv.grandTotal || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                    ₹{(((inv.amountPaid ?? inv.paidAmount ?? 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td><span className={`badge ${STATUS_BADGES[inv.status] || 'badge-default'}`}>{inv.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link to={`/invoices/${inv.id}`} className="btn btn-ghost btn-sm" title="View"><Eye size={14} /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Showing {(page-1)*20+1}–{Math.min(page*20, pagination.total)} of {pagination.total}</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn btn-secondary btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
