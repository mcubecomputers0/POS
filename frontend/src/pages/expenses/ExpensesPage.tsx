import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Receipt, Trash2 } from 'lucide-react';
import { expenseApi } from '../../api';
import toast from 'react-hot-toast';
import ExpenseModal from './ExpenseModal';

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const { data } = useQuery({ queryKey: ['expenses', page, search], queryFn: () => expenseApi.list({ page, limit: 20, search }) });
  const items = data?.data ?? [];
  const pagination = data?.pagination;
  const totalExpenses = items.reduce((sum: number, e: any) => sum + (e.totalAmount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Expenses</h1><p className="page-subtitle">{pagination?.total ?? 0} expenses • Total: ₹{(totalExpenses / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Expense</button></div>
      </div>
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input"><Search size={16} style={{ color: 'var(--color-text-dim)' }} /><input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Method</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><Receipt size={32} /></div><div className="empty-state-title">No expenses recorded</div></div></td></tr>
              : items.map((e: any) => (
                <tr key={e.id}>
                  <td><div style={{ fontWeight: 500 }}>{e.description}</div>{e.vendor && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{e.vendor}</div>}</td>
                  <td>{e.category?.name ?? '—'}</td>
                  <td>{new Date(e.expenseDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ textTransform: 'capitalize' }}>{e.paymentMethod?.replace('_', ' ')}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{(e.totalAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${e.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <ExpenseModal onClose={() => setShowModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setShowModal(false); }} />}
    </div>
  );
}
