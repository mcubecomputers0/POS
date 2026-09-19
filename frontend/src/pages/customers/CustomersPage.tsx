import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Eye, Edit2, Trash2, Phone, Mail } from 'lucide-react';
import { customerApi } from '../../api';
import toast from 'react-hot-toast';
import CustomerModal from './CustomerModal';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [customerType, setCustomerType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, customerType],
    queryFn: () => customerApi.list({ page, limit: 20, search, customerType: customerType || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: customerApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer deactivated'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const customers = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} customers</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setEditCustomer(null); setShowModal(true); }}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
            <input placeholder="Search by name, phone, GSTIN..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ width: 'auto' }} value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
            <option value="">All Types</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="export">Export</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>GSTIN</th>
                <th>City</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'right' }}>Invoices</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Users size={32} /></div>
                    <div className="empty-state-title">No customers found</div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Customer</button>
                  </div>
                </td></tr>
              ) : customers.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <div>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', display: 'flex', gap: 8, marginTop: 2 }}>
                        {c.phone && <span><Phone size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {c.phone}</span>}
                        {c.email && <span><Mail size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {c.email}</span>}
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${c.customerType === 'B2B' ? 'badge-info' : c.customerType === 'export' ? 'badge-warning' : 'badge-default'}`}>{c.customerType}</span></td>
                  <td><span className="text-sm text-muted">{c.gstin || '—'}</span></td>
                  <td><span className="text-sm">{c.city || '—'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ color: c.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: c.outstandingAmount > 0 ? 600 : 400 }}>
                      ₹{(c.outstandingAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{c.invoiceCount ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link to={`/customers/${c.id}`} className="btn btn-ghost btn-sm" title="View"><Eye size={14} /></Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditCustomer(c); setShowModal(true); }} title="Edit"><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => { if (confirm(`Deactivate "${c.name}"?`)) deleteMutation.mutate(c.id); }} title="Delete"><Trash2 size={14} /></button>
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

      {showModal && (
        <CustomerModal
          customer={editCustomer}
          onClose={() => { setShowModal(false); setEditCustomer(null); }}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowModal(false); setEditCustomer(null); }}
        />
      )}
    </div>
  );
}
