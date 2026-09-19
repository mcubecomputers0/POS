import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Truck, Edit2, Phone, Mail } from 'lucide-react';
import { supplierApi } from '../../api';
import toast from 'react-hot-toast';
import SupplierModal from './SupplierModal';

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => supplierApi.list({ page, limit: 20, search }),
  });

  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} suppliers</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setEditSupplier(null); setShowModal(true); }}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input">
          <Search size={16} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
          <input placeholder="Search suppliers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th><th>GSTIN</th><th>City</th>
                <th style={{ textAlign: 'right' }}>Payable</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>)
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Truck size={32} /></div>
                    <div className="empty-state-title">No suppliers found</div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Supplier</button>
                  </div>
                </td></tr>
              ) : suppliers.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <div><div style={{ fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', display: 'flex', gap: 8, marginTop: 2 }}>
                        {s.phone && <span><Phone size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {s.phone}</span>}
                        {s.email && <span><Mail size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {s.email}</span>}
                      </div>
                    </div>
                  </td>
                  <td><span className="text-sm text-muted">{s.gstin || '—'}</span></td>
                  <td><span className="text-sm">{s.city || '—'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ color: s.outstandingAmount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: s.outstandingAmount > 0 ? 600 : 400 }}>
                      ₹{(s.outstandingAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditSupplier(s); setShowModal(true); }}><Edit2 size={14} /></button>
                  </td>
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

      {showModal && <SupplierModal supplier={editSupplier} onClose={() => { setShowModal(false); setEditSupplier(null); }} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setShowModal(false); setEditSupplier(null); }} />}
    </div>
  );
}
