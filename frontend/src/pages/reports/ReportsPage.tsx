import { Link } from 'react-router-dom';
import { BarChart3, FileText, Package, TrendingUp, PieChart, Users } from 'lucide-react';

const REPORT_CARDS = [
  { to: '/reports/gst', icon: FileText, label: 'GST Reports', desc: 'GSTR-1, GSTR-3B, HSN Summary', color: '#1a56db' },
  { to: '/reports?type=sales', icon: TrendingUp, label: 'Sales Report', desc: 'Sales analysis and trends', color: '#10b981' },
  { to: '/reports?type=purchases', icon: Package, label: 'Purchase Report', desc: 'Purchase analysis and supplier stats', color: '#7c3aed' },
  { to: '/reports?type=inventory', icon: Package, label: 'Inventory Report', desc: 'Stock levels, movements, valuation', color: '#f59e0b' },
  { to: '/reports?type=customers', icon: Users, label: 'Customer Report', desc: 'Customer ledger and outstanding', color: '#06b6d4' },
  { to: '/reports?type=profit', icon: PieChart, label: 'Profit & Loss', desc: 'P&L statement for period', color: '#ec4899' },
];

export default function ReportsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">Reports</h1><p className="page-subtitle">Business analytics and financial reports</p></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {REPORT_CARDS.map(({ to, icon: Icon, label, desc, color }) => (
          <Link key={to} to={to} className="card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
              <Icon size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{label}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
