import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Plus } from 'lucide-react';
import { useAuthStore } from '../../store';

export default function CompanySelectPage() {
  const navigate = useNavigate();
  const { companies, switchCompany, user } = useAuthStore();

  const handleSelect = (companyId: string) => {
    switchCompany(companyId);
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <img
            src="./icon.png"
            alt="வியாபாரம் (VIYABARAM CLOUD)"
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--radius-xl)',
              margin: '0 auto var(--space-3)',
              boxShadow: '0 6px 20px rgba(26, 86, 219, 0.3)',
              display: 'block',
              objectFit: 'cover',
            }}
          />
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Select a Company</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>Welcome back, {user?.name}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {companies.map((company) => (
            <button
              key={company.companyId}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: 'pointer', background: 'none', border: '1px solid var(--color-border)', textAlign: 'left', width: '100%', transition: 'all 0.2s' }}
              onClick={() => handleSelect(company.companyId)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
            >
              <div className="avatar avatar-lg">
                {company.companyName.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{company.companyName}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {company.role.displayName} {company.gstin && `• GSTIN: ${company.gstin}`}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--color-text-dim)' }} />
            </button>
          ))}

          <button
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: 'pointer', background: 'none', border: '2px dashed var(--color-border)', textAlign: 'left', width: '100%', color: 'var(--color-text-muted)' }}
            onClick={() => navigate('/create-company')}
          >
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Add New Company</div>
              <div style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>Create or join a new company</div>
            </div>
          </button>
        </div>

        {/* Software credits & license rights */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-dim)',
          lineHeight: 1.6,
        }}>
          <div>Software Developed By: <strong style={{ color: 'var(--color-text)' }}>MCube Computers</strong></div>
          <div>License Rights: <strong style={{ color: 'var(--color-text)' }}>MCube Computers</strong></div>
        </div>
      </div>
    </div>
  );
}
