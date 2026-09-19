import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  FileText, ShoppingBag, RotateCcw, CreditCard, Receipt,
  BarChart3, Settings, LogOut, Bell, ChevronDown,
  Menu, X, Building2, Shield, ClipboardList, FileSearch,
  Wallet, ChevronRight, Zap, UserCheck, Warehouse, Tag, User, Layers, Palette
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store';
import { authApi } from '../../api';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/pos', icon: Zap, label: 'POS Billing', badge: null },
    ],
  },
  {
    section: 'Sales',
    items: [
      { to: '/invoices', icon: FileText, label: 'Invoices' },
      { to: '/quotations', icon: ClipboardList, label: 'Quotations' },
      { to: '/sales-returns', icon: RotateCcw, label: 'Sales Returns' },
      { to: '/templates', icon: Palette, label: 'Invoice Templates' },
    ],
  },
  {
    section: 'Purchases',
    items: [
      { to: '/purchases', icon: ShoppingBag, label: 'Purchases' },
    ],
  },
  {
    section: 'Parties',
    items: [
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/suppliers', icon: Truck, label: 'Suppliers' },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/products', icon: Package, label: 'Products' },
      { to: '/categories', icon: Layers, label: 'Categories & Brands' },
      { to: '/inventory', icon: Warehouse, label: 'Stock & Movements' },
      { to: '/barcodes', icon: Tag, label: 'Barcode Labels' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/payments', icon: Wallet, label: 'Payments' },
      { to: '/expenses', icon: Receipt, label: 'Expenses' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports' },
      { to: '/reports/gst', icon: FileSearch, label: 'GST Reports' },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/staff', icon: UserCheck, label: 'Staff' },
      { to: '/roles', icon: Shield, label: 'Roles & Permissions' },
      { to: '/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, currentCompany, companies, logout, switchCompany, refreshToken } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setCompanyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {/* ignore */}
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  const initials = user?.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          {!sidebarCollapsed && (
            <div>
              <div className="sidebar-logo-text">CloudGST Pro</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>Billing & Inventory</div>
            </div>
          )}
        </div>

        {/* Company Switcher */}
        {!sidebarCollapsed && currentCompany && (
          <div className="company-switcher">
            <button className="company-switcher-btn" onClick={() => setCompanyMenuOpen(!companyMenuOpen)}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                {currentCompany.companyName.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="company-name">{currentCompany.companyName}</div>
                <div className="company-type">{currentCompany.role.displayName}</div>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
            </button>

            {companyMenuOpen && companies.length > 1 && (
              <div className="dropdown-menu" style={{ position: 'relative', top: 4 }}>
                {companies.map((co) => (
                  <button
                    key={co.companyId}
                    className="dropdown-item"
                    style={{ width: '100%', border: 'none', background: 'none' }}
                    onClick={() => { switchCompany(co.companyId); setCompanyMenuOpen(false); }}
                  >
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                      {co.companyName.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{co.companyName}</span>
                    {co.companyId === currentCompany.companyId && (
                      <span style={{ marginLeft: 'auto', color: 'var(--color-success)', fontSize: 10 }}>✓</span>
                    )}
                  </button>
                ))}
                <div className="dropdown-divider" />
                <button className="dropdown-item" style={{ width: '100%', border: 'none', background: 'none' }} onClick={() => navigate('/create-company')}>
                  <Building2 size={14} /> Add Company
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => (
            <div key={section.section}>
              <div className="nav-section-title">{section.section}</div>
              {section.items.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-item ${isActive(to) ? 'active' : ''}`}
                  title={sidebarCollapsed ? label : undefined}
                >
                  <Icon size={18} className="nav-item-icon" />
                  <span className="nav-item-text">{label}</span>
                </Link>
              ))}
            </div>
          ))}

          {/* Super Admin Link */}
          {user?.isSuperAdmin && (
            <>
              <div className="nav-section-title">Super Admin</div>
              <Link to="/super-admin" className={`nav-item ${isActive('/super-admin') ? 'active' : ''}`}>
                <Shield size={18} className="nav-item-icon" />
                <span className="nav-item-text">Admin Panel</span>
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Bar */}
        <header className="topbar">
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleSidebar}
            style={{ marginRight: 'var(--space-3)' }}
          >
            {sidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
          </button>

          <div style={{ flex: 1 }} />

          {/* Notifications */}
          <div className="dropdown" style={{ marginRight: 'var(--space-2)' }}>
            <button className="btn btn-ghost btn-sm" style={{ position: 'relative' }} onClick={() => setNotifOpen(!notifOpen)}>
              <Bell size={18} />
              <span style={{
                position: 'absolute', top: 2, right: 2, width: 8, height: 8,
                background: 'var(--color-danger)', borderRadius: '50%',
              }} />
            </button>
            {notifOpen && (
              <div className="dropdown-menu" style={{ width: 320 }}>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                  Notifications
                </div>
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  No new notifications
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="dropdown" ref={userMenuRef}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{ gap: 'var(--space-2)' }}
            >
              <div className="avatar">{initials}</div>
              <span className="nav-item-text" style={{ display: 'none' }}>{user?.name}</span>
              <ChevronDown size={14} />
            </button>

            {userMenuOpen && (
              <div className="dropdown-menu">
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user?.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{user?.email}</div>
                </div>
                <Link to="/profile" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  <User size={14} /> My Profile
                </Link>
                <Link to="/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  <Settings size={14} /> Settings
                </Link>
                <Link to="/select-company" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  <Building2 size={14} /> Switch Company
                </Link>
                <div className="dropdown-divider" />
                <button className="dropdown-item danger" style={{ width: '100%', border: 'none', background: 'none' }} onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {[
            { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/pos', icon: Zap, label: 'POS' },
            { to: '/invoices', icon: FileText, label: 'Invoices' },
            { to: '/products', icon: Package, label: 'Products' },
            { to: '/reports', icon: BarChart3, label: 'Reports' },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className={`mobile-nav-item ${isActive(to) ? 'active' : ''}`}>
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
