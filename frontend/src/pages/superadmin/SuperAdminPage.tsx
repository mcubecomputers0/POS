import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '../../api';
import { Shield, Building2, Users, TrendingUp } from 'lucide-react';

export default function SuperAdminPage() {
  const { data: statsData } = useQuery({ queryKey: ['sa-stats'], queryFn: superAdminApi.stats });
  const { data: companiesData } = useQuery({ queryKey: ['sa-companies'], queryFn: () => superAdminApi.companies({ limit: 20 }) });
  const stats = statsData?.data;
  const companies = companiesData?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
            <Shield size={20} style={{ color: 'var(--brand-primary)' }} />
            <span className="badge badge-primary">Super Admin</span>
          </div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Manage all tenants and system configuration</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'Total Companies', value: stats?.totalCompanies ?? 0, icon: Building2, color: '#1a56db' },
          { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: '#7c3aed' },
          { label: 'Active Subscriptions', value: stats?.activeSubscriptions ?? 0, icon: TrendingUp, color: '#10b981' },
          { label: 'Monthly Revenue', value: `₹${((stats?.monthlyRevenue ?? 0) / 100).toLocaleString('en-IN')}`, icon: TrendingUp, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20`, color }}>
              <Icon size={22} />
            </div>
            <div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Companies Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>All Companies</div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Company</th><th>GSTIN</th><th>Plan</th><th>Status</th><th>Users</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {companies.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-message">No companies yet</div></div></td></tr>
              : companies.map((c: any) => (
                <tr key={c.id}>
                  <td><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{c.email}</div></td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{c.gstin || '—'}</td>
                  <td><span className="badge badge-info">{c.subscription?.plan?.displayName ?? 'Free'}</span></td>
                  <td><span className={`badge ${c.isActive ? 'badge-success' : 'badge-danger'}`}>{c.isActive ? 'Active' : 'Suspended'}</span></td>
                  <td>{c._count?.companyUsers ?? 0}</td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => superAdminApi.toggleCompany(c.id)}>
                      {c.isActive ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
