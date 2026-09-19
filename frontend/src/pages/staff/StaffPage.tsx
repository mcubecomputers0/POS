import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserCheck, Pencil } from 'lucide-react';
import { staffApi } from '../../api';
import StaffModal from './StaffModal';

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
  });

  const staff = (data?.data ?? []).filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.user?.name?.toLowerCase().includes(q) ||
      s.user?.email?.toLowerCase().includes(q) ||
      s.role?.displayName?.toLowerCase().includes(q) ||
      s.designation?.toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: any) => {
    setEditingStaff(s);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setEditingStaff(null);
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">{staff.length} staff member{staff.length === 1 ? '' : 's'}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add Staff
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div className="search-input">
          <Search size={16} style={{ color: 'var(--color-text-dim)' }} />
          <input
            placeholder="Search staff by name, email, role, or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><UserCheck size={32} /></div>
                      <div className="empty-state-title">No staff members found</div>
                      <p className="empty-state-message">Add team members to assign roles and permissions.</p>
                      <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                        <Plus size={14} /> Add Staff
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                staff.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {s.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>{s.user?.name}</span>
                          {s.isOwner && (
                            <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10 }}>Owner</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{s.user?.email}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{s.user?.phone || '—'}</td>
                    <td><span className="badge badge-primary">{s.role?.displayName || s.role?.name}</span></td>
                    <td>{s.designation || '—'}</td>
                    <td>{s.department || '—'}</td>
                    <td>
                      <span className={`badge ${s.isActive ? 'badge-success' : 'badge-default'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!s.isOwner && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Staff Member"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <StaffModal
          staff={editingStaff}
          onClose={() => { setModalOpen(false); setEditingStaff(null); }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
