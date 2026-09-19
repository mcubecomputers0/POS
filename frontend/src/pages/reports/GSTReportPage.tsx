import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { reportApi } from '../../api';

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_fy', label: 'This Financial Year' },
];

function formatRupee(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function GSTReportPage() {
  const [period, setPeriod] = useState('this_month');

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['gst-summary', period],
    queryFn: () => reportApi.gstSummary({ period }),
  });

  const { data: hsnData } = useQuery({
    queryKey: ['hsn-summary', period],
    queryFn: () => reportApi.hsnSummary({ period }),
  });

  const summary = summaryData?.data;
  const hsnItems = hsnData?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">GST Reports</h1><p className="page-subtitle">GSTR-1, GSTR-3B, and HSN Summary</p></div>
        <div className="page-actions">
          <select className="form-control" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto' }}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* GST Summary Cards */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'Total Sales (Taxable)', value: summary?.taxableAmount, color: '#1a56db' },
          { label: 'CGST Output', value: summary?.cgst, color: '#10b981' },
          { label: 'SGST Output', value: summary?.sgst, color: '#10b981' },
          { label: 'IGST Output', value: summary?.igst, color: '#7c3aed' },
        ].map((card) => (
          <div key={card.label} className="card" style={{ border: `1px solid ${card.color}30` }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: card.color, fontFamily: 'var(--font-display)' }}>
              {isLoading ? <div className="skeleton" style={{ height: 32, width: 120 }} /> : formatRupee(card.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Net Tax Payable */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', background: 'linear-gradient(135deg, var(--brand-primary), #1240b0)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-sm)' }}>Net GST Payable</div>
            <div style={{ color: 'white', fontSize: 'var(--text-3xl)', fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 4 }}>
              {isLoading ? '...' : formatRupee((summary?.cgst ?? 0) + (summary?.sgst ?? 0) + (summary?.igst ?? 0))}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-sm)' }}>
            <div>Input Tax Credit (ITC): {formatRupee(summary?.inputCredit ?? 0)}</div>
            <div style={{ marginTop: 4 }}>Invoices: {summary?.invoiceCount ?? 0} | B2B: {summary?.b2bCount ?? 0} | B2C: {summary?.b2cCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* HSN Summary */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">HSN/SAC Summary</div>
          <div className="card-subtitle">Summary of taxable supplies by HSN code</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>HSN Code</th><th>Description</th><th>UOM</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Taxable Value</th>
                <th style={{ textAlign: 'right' }}>GST Rate</th>
                <th style={{ textAlign: 'right' }}>IGST</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {hsnItems.length === 0 ? (
                <tr><td colSpan={10}><div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>No HSN data for selected period</div></td></tr>
              ) : hsnItems.map((h: any) => (
                <tr key={h.hsnCode}>
                  <td style={{ fontWeight: 600 }}>{h.hsnCode || '—'}</td>
                  <td>{h.description}</td>
                  <td>{h.uom || 'PCS'}</td>
                  <td style={{ textAlign: 'right' }}>{h.totalQty}</td>
                  <td style={{ textAlign: 'right' }}>{formatRupee(h.taxableAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{h.gstRate}%</td>
                  <td style={{ textAlign: 'right' }}>{formatRupee(h.igst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatRupee(h.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatRupee(h.sgst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatRupee(h.igst + h.cgst + h.sgst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
