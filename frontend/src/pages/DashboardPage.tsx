import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  Package, Users, AlertTriangle, ArrowRight, RefreshCw,
  CreditCard, Receipt, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { dashboardApi } from '../api';
import { useAuthStore } from '../store';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_fy', label: 'This FY' },
];

const PAYMENT_COLORS = ['#1a56db', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function StatCard({ icon: Icon, label, value, change, color, prefix }: any) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}20`, color }}>
        <Icon size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="stat-value currency">
          {prefix || ''}{typeof value === 'number' ? value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : value}
        </div>
        <div className="stat-label">{label}</div>
        {change !== undefined && (
          <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}% vs last period
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="stat-card">
      <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 28, width: '60%' }} />
        <div className="skeleton" style={{ height: 14, width: '80%' }} />
      </div>
    </div>
  );
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color, fontSize: 'var(--text-sm)' }}>
            {entry.name}: {typeof entry.value === 'number' && entry.name?.toLowerCase().includes('amount')
              ? formatCurrency(entry.value)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { currentCompany } = useAuthStore();
  const [period, setPeriod] = useState('this_month');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => dashboardApi.getSummary({ period }),
    staleTime: 1000 * 60 * 2,
  });

  const kpis = data?.data?.kpis;
  const gst = data?.data?.gstSummary;
  const charts = data?.data?.charts;
  const alerts = data?.data?.alerts;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {currentCompany?.companyName} â€” Overview for{' '}
            <span style={{ color: 'var(--brand-primary)' }}>
              {PERIODS.find((p) => p.value === period)?.label}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <select
            className="form-control"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: 'auto' }}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/pos" className="btn btn-primary">
            <ShoppingCart size={16} /> New Sale
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard icon={DollarSign} label="Total Sales" value={kpis?.totalSales ?? 0} color="#1a56db" prefix="â‚¹" />
            <StatCard icon={ShoppingCart} label="Total Invoices" value={kpis?.salesCount ?? 0} color="#7c3aed" />
            <StatCard icon={TrendingUp} label="Est. Profit" value={kpis?.estimatedProfit ?? 0} color="#10b981" prefix="â‚¹" />
            <StatCard icon={AlertTriangle} label="Receivables" value={kpis?.totalReceivables ?? 0} color="#f59e0b" prefix="â‚¹" />
            <StatCard icon={Package} label="Total Products" value={kpis?.totalProducts ?? 0} color="#06b6d4" />
            <StatCard icon={Users} label="Customers" value={kpis?.totalCustomers ?? 0} color="#ec4899" />
            <StatCard icon={Receipt} label="Expenses" value={kpis?.totalExpenses ?? 0} color="#ef4444" prefix="â‚¹" />
            <StatCard icon={CreditCard} label="Payables" value={kpis?.totalPayables ?? 0} color="#f97316" prefix="â‚¹" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Sales Trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Sales Trend</div>
              <div className="card-subtitle">Daily sales over last 30 days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts?.salesByDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} tickFormatter={(v) => `â‚¹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="amount" name="Sales Amount" stroke="#1a56db" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Payment Methods</div>
              <div className="card-subtitle">Collections breakdown</div>
            </div>
          </div>
          {charts?.paymentMethods?.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={charts.paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="amount"
                  >
                    {charts.paymentMethods.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {charts.paymentMethods.map((pm: any, i: number) => (
                  <div key={pm.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                      <span style={{ textTransform: 'capitalize' }}>{pm.method}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {formatCurrency(pm.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No payment data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* GST Summary */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">GST Summary</div>
              <div className="card-subtitle">Tax liability for period</div>
            </div>
            <Link to="/reports/gst" className="btn btn-ghost btn-sm">View Full Report <ArrowRight size={14} /></Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { label: 'Taxable Amount', value: gst?.taxableAmount, color: 'var(--color-text)' },
              { label: 'CGST (Output)', value: gst?.cgst, color: 'var(--brand-primary)' },
              { label: 'SGST (Output)', value: gst?.sgst, color: 'var(--brand-secondary)' },
              { label: 'IGST (Output)', value: gst?.igst, color: 'var(--brand-accent)' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.color }}>{formatCurrency(item.value ?? 0)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <span style={{ fontWeight: 600 }}>Net GST Payable</span>
              <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: 'var(--text-lg)' }}>
                {formatCurrency((gst?.cgst ?? 0) + (gst?.sgst ?? 0) + (gst?.igst ?? 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Top Products + Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Low Stock Alerts */}
          {alerts?.lowStockProducts?.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--color-warning)' }}>
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ color: 'var(--color-warning)' }}>
                    <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6 }} />
                    Low Stock Alert
                  </div>
                  <div className="card-subtitle">{alerts.lowStockProducts.length} products need restocking</div>
                </div>
                <Link to="/products?lowStock=true" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} /></Link>
              </div>
              {alerts.lowStockProducts.slice(0, 3).map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', fontSize: 'var(--text-sm)' }}>
                  <span className="truncate">{p.name}</span>
                  <span className="badge badge-warning">{p.currentStock} left</span>
                </div>
              ))}
            </div>
          )}

          {/* Top Products */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Top Products</div>
                <div className="card-subtitle">Best selling this period</div>
              </div>
            </div>
            {charts?.topProducts?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {charts.topProducts.map((tp: any, i: number) => (
                  <div key={tp.product?.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-md)', background: `${PAYMENT_COLORS[i]}20`, color: PAYMENT_COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div className="truncate" style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{tp.product?.name}</div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{formatCurrency(tp.totalAmount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <BarChart3 size={32} style={{ color: 'var(--color-text-dim)' }} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Create invoices to see top products</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

