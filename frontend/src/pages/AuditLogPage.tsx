import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api';
import { ClipboardList } from 'lucide-react';

export default function AuditLogPage() {
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs'], queryFn: () => auditApi.list({ limit: 50 }) });
  const logs = data?.data ?? [];

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'badge-success', UPDATE: 'badge-info', DELETE: 'badge-danger', CANCEL: 'badge-warning',
    LOGIN: 'badge-primary', LOGOUT: 'badge-default',
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Audit Log</h1><p className="page-subtitle">Track all actions performed in the system</p></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Action</th><th>Module</th><th>User</th><th>Description</th><th>IP Address</th><th>Date & Time</th></tr></thead>
            <tbody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>)
              : logs.length === 0 ? <tr><td colSpan={6}>
                <div className="empty-state"><div className="empty-state-icon"><ClipboardList size={32} /></div><div className="empty-state-title">No audit logs yet</div></div>
              </td></tr>
              : logs.map((log: any) => (
                <tr key={log.id}>
                  <td><span className={`badge ${ACTION_COLORS[log.action] || 'badge-default'}`}>{log.action}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{log.module?.replace('_', ' ')}</td>
                  <td>
                    <div style={{ fontSize: 'var(--text-sm)' }}>{log.user?.name ?? 'System'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{log.user?.email}</div>
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)', maxWidth: 300 }}>{log.description}</td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{log.ipAddress || '—'}</td>
                  <td style={{ fontSize: 'var(--text-xs)' }}>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
