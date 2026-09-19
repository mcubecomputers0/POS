import { useQuery } from '@tanstack/react-query';
import { Shield, Check, X } from 'lucide-react';
import { roleApi } from '../../api';

export default function RolesPage() {
  const { data } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });
  const { data: permData } = useQuery({ queryKey: ['permissions'], queryFn: roleApi.permissions });
  const roles = data?.data ?? [];
  const permissions = permData?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Roles & Permissions</h1><p className="page-subtitle">Manage access control for your team</p></div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {roles.map((role: any) => (
          <div key={role.id} className="card">
            <div className="card-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Shield size={16} style={{ color: 'var(--brand-primary)' }} />
                  <div className="card-title">{role.displayName}</div>
                  {role.isSystem && <span className="badge badge-info">System</span>}
                </div>
                {role.description && <div className="card-subtitle">{role.description}</div>}
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>
              {role.permissions?.length ?? 0} permissions granted
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
