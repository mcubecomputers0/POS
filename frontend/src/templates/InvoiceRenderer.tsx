import React from 'react';
import { TemplateConfig } from '../types/templates';

interface Props {
  invoice: any;
  company: any;
  config: TemplateConfig;
  printRef?: React.RefObject<HTMLDivElement>;
}

function formatRupee(paise?: number | null) {
  if (paise === undefined || paise === null || isNaN(paise)) return '₹0.00';
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function formatDate(dateStr?: string | Date | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  roboto: "'Roboto', sans-serif",
  poppins: "'Poppins', sans-serif",
  outfit: "'Outfit', sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  mono: "'Courier New', Courier, monospace",
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const FONT_SIZE_MAP: Record<string, { base: number; small: number; heading: number; title: number }> = {
  small: { base: 11, small: 10, heading: 14, title: 18 },
  medium: { base: 12.5, small: 11, heading: 16, title: 22 },
  large: { base: 14, small: 12, heading: 18, title: 26 },
};

export default function InvoiceRenderer({ invoice: inv, company, config, printRef }: Props) {
  if (!inv) return null;

  const isThermal = config.paperSize === 'thermal_80' || config.paperSize === 'thermal_58';
  const isThermal58 = config.paperSize === 'thermal_58';
  const isInterState = Boolean(inv.isInterState);

  const primary = config.primaryColor || '#1a56db';
  const secondary = config.secondaryColor || '#0f172a';
  const accent = config.accentColor || '#f8fafc';
  const text = config.textColor || '#1e293b';

  const fontFamily = FONT_MAP[config.fontFamily] || FONT_MAP.inter;
  const sizes = FONT_SIZE_MAP[config.fontSize] || FONT_SIZE_MAP.medium;

  const logo = (config as any).logoImage || company?.logoPath;
  const logoUrl = logo
    ? (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('data:')
        ? logo
        : (logo.startsWith('/') ? logo : `/${logo}`))
    : null;

  // Extract customer display name and phone
  let billToName = inv.customer?.name || inv.customerName;
  let billToPhone = inv.customer?.phone || inv.customerPhone;
  let displayNotes = config.customNotes || inv.notes;

  if (!billToName && inv.notes) {
    const match = inv.notes.match(/Walk-in:\s*([^•\n\r]+)(?:\s*•\s*([^\n\r]+))?/i);
    if (match) {
      billToName = match[1].trim();
      if (!billToPhone && match[2]) billToPhone = match[2].trim();
      if (!config.customNotes) {
        displayNotes = inv.notes.replace(/Walk-in:\s*[^\n\r]+[\n\r]?/i, '').trim() || null;
      }
    }
  }
  if (!billToName) billToName = 'Walk-in Customer';

  const primaryBank = company?.bankAccounts?.find((b: any) => b.isPrimary) || company?.bankAccounts?.[0];
  const paymentMethod = inv.paymentMethod || inv.payments?.[0]?.paymentMethod || 'Cash';
  const amountPaid = inv.amountPaid ?? inv.paidAmount ?? 0;
  const balanceDue = inv.balanceDue ?? inv.balanceAmount ?? 0;

  // ─────────────────────────────────────────────────────────────
  // THERMAL RECEIPT RENDERER (58mm and 80mm)
  // ─────────────────────────────────────────────────────────────
  if (isThermal) {
    const slipWidth = isThermal58 ? 260 : 320;
    return (
      <div
        ref={printRef}
        className="thermal-receipt"
        style={{
          width: slipWidth,
          maxWidth: '100%',
          margin: '0 auto',
          background: '#ffffff',
          color: '#000000',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: isThermal58 ? 10 : 11,
          lineHeight: 1.3,
          padding: isThermal58 ? '10px 6px' : '16px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Store Info */}
        <div style={{ textAlign: 'center', marginBottom: 8, borderBottom: '1px dashed #000', paddingBottom: 8 }}>
          {config.showLogo !== false && logoUrl && (
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
              <img
                src={logoUrl}
                alt="Logo"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.retried && logo) {
                    target.dataset.retried = 'true';
                    target.src = `http://localhost:4000${logo.startsWith('/') ? '' : '/'}${logo}`;
                  }
                }}
                style={{ maxHeight: 36, maxWidth: 100, objectFit: 'contain' }}
              />
            </div>
          )}
          <div style={{ fontWeight: 'bold', fontSize: isThermal58 ? 13 : 16 }}>{company?.name || 'STORE RECEIPT'}</div>
          {config.showCompanyAddress && (
            <div style={{ fontSize: isThermal58 ? 9 : 10, marginTop: 2 }}>
              {[company?.addressLine1, company?.city].filter(Boolean).join(', ')}
            </div>
          )}
          {config.showCompanyPhone && company?.phone && (
            <div style={{ fontSize: isThermal58 ? 9 : 10 }}>Tel: {company.phone}</div>
          )}
          {config.showCompanyGstin && company?.gstin && (
            <div style={{ fontSize: isThermal58 ? 9 : 10, fontWeight: 'bold' }}>GSTIN: {company.gstin}</div>
          )}
        </div>

        {/* Invoice Title & Meta */}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: isThermal58 ? 11 : 12, marginBottom: 4 }}>
          {config.invoiceTitle || 'CASH RECEIPT'}
        </div>
        <div style={{ fontSize: isThermal58 ? 9 : 10, marginBottom: 8, borderBottom: '1px dashed #000', paddingBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Rcpt: #{inv.invoiceNumber}</span>
            <span>{formatDate(inv.invoiceDate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span>Cust: {billToName}</span>
            <span>{paymentMethod.toUpperCase()}</span>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: 8, borderBottom: '1px dashed #000', paddingBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: isThermal58 ? 9 : 10, marginBottom: 4 }}>
            <span style={{ flex: 1 }}>ITEM</span>
            <span style={{ width: 40, textAlign: 'center' }}>QTY</span>
            <span style={{ width: 60, textAlign: 'right' }}>AMT(₹)</span>
          </div>
          {(inv.items ?? []).map((item: any, idx: number) => (
            <div key={idx} style={{ marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{item.description || item.product?.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isThermal58 ? 9 : 10, color: '#333' }}>
                <span>@{((item.rate || 0) / 100).toFixed(2)}</span>
                <span style={{ width: 40, textAlign: 'center' }}>{item.quantity}</span>
                <span style={{ width: 60, textAlign: 'right', fontWeight: 'bold' }}>
                  {((item.totalAmount || 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ fontSize: isThermal58 ? 10 : 11, marginBottom: 8, borderBottom: '1px dashed #000', paddingBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>₹{((inv.subtotal || 0) / 100).toFixed(2)}</span>
          </div>
          {inv.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount</span>
              <span>-₹{((inv.discountAmount || 0) / 100).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Taxable</span>
            <span>₹{((inv.taxableAmount || 0) / 100).toFixed(2)}</span>
          </div>
          {!isInterState ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CGST</span>
                <span>₹{((inv.cgstAmount || 0) / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SGST</span>
                <span>₹{((inv.sgstAmount || 0) / 100).toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IGST</span>
              <span>₹{((inv.igstAmount || 0) / 100).toFixed(2)}</span>
            </div>
          )}
          {config.showRoundOff && inv.roundOff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Round Off</span>
              <span>₹{((inv.roundOff || 0) / 100).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: isThermal58 ? 12 : 14, marginTop: 4 }}>
            <span>TOTAL</span>
            <span>{formatRupee(inv.grandTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isThermal58 ? 9 : 10, marginTop: 2 }}>
            <span>Paid Amount</span>
            <span>{formatRupee(amountPaid)}</span>
          </div>
          {balanceDue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isThermal58 ? 9 : 10, fontWeight: 'bold' }}>
              <span>Change / Due</span>
              <span>{formatRupee(balanceDue)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: isThermal58 ? 9 : 10 }}>
          {config.customTerms && <div style={{ marginBottom: 4 }}>{config.customTerms}</div>}
          <div style={{ fontWeight: 'bold', marginTop: 4 }}>THANK YOU! VISIT AGAIN</div>
          <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>CloudGST Pro POS</div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // A4 / A5 STANDARD TEMPLATES (MODERN, CLASSIC, MINIMAL, ETC.)
  // ─────────────────────────────────────────────────────────────
  const isMinimal = config.headerStyle === 'clean';
  const isBoxed = config.headerStyle === 'boxed';
  const isGradient = config.headerStyle === 'gradient';
  const paperWidth = config.paperSize === 'a5' ? 620 : 840;

  return (
    <div
      ref={printRef}
      className="invoice-render-box"
      style={{
        maxWidth: paperWidth,
        margin: '0 auto',
        background: '#ffffff',
        color: text,
        fontFamily,
        fontSize: sizes.base,
        lineHeight: 1.45,
        padding: config.paperSize === 'a5' ? 20 : 32,
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        position: 'relative',
      }}
    >
      {/* Optional Watermark */}
      {config.watermarkText && (
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: 72,
            fontWeight: 900,
            color: 'rgba(0, 0, 0, 0.03)',
            userSelect: 'none',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {config.watermarkText}
        </div>
      )}

      {/* ─── HEADER ─── */}
      {isGradient ? (
        <div
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
            color: '#ffffff',
            padding: '24px 28px',
            borderRadius: 8,
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {config.showLogo !== false && logoUrl && (
              <div
                style={{
                  background: '#ffffff',
                  padding: '6px 10px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried && logo) {
                      target.dataset.retried = 'true';
                      target.src = `http://localhost:4000${logo.startsWith('/') ? '' : '/'}${logo}`;
                    }
                  }}
                  style={{ maxHeight: 52, maxWidth: 120, objectFit: 'contain' }}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: sizes.title, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {company?.name || 'Company Name'}
              </div>
              {config.showCompanyAddress && (
                <div style={{ fontSize: sizes.small, opacity: 0.9, marginTop: 4 }}>
                  {[company?.addressLine1, company?.city, company?.state].filter(Boolean).join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, fontSize: sizes.small, opacity: 0.9, marginTop: 2 }}>
                {config.showCompanyGstin && company?.gstin && <span>GSTIN: <strong>{company.gstin}</strong></span>}
                {config.showCompanyPhone && company?.phone && <span>Ph: {company.phone}</span>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: sizes.heading, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {config.invoiceTitle || 'TAX INVOICE'}
            </div>
            <div style={{ fontSize: sizes.small, marginTop: 6, opacity: 0.9 }}>
              Inv No: <strong>{inv.invoiceNumber}</strong>
            </div>
            <div style={{ fontSize: sizes.small, opacity: 0.9 }}>Date: {formatDate(inv.invoiceDate)}</div>
          </div>
        </div>
      ) : isBoxed ? (
        <div
          style={{
            border: `2px solid ${primary}`,
            padding: 16,
            marginBottom: 20,
            background: accent,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {config.showLogo !== false && logoUrl && (
              <div
                style={{
                  background: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried && logo) {
                      target.dataset.retried = 'true';
                      target.src = `http://localhost:4000${logo.startsWith('/') ? '' : '/'}${logo}`;
                    }
                  }}
                  style={{ maxHeight: 52, maxWidth: 120, objectFit: 'contain' }}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: sizes.title, fontWeight: 800, color: primary }}>{company?.name}</div>
              {config.showCompanyAddress && (
                <div style={{ fontSize: sizes.small, color: '#4b5563', marginTop: 4 }}>
                  {[company?.addressLine1, company?.city, company?.state].filter(Boolean).join(', ')}
                </div>
              )}
              {config.showCompanyGstin && company?.gstin && (
                <div style={{ fontSize: sizes.small, marginTop: 2 }}>GSTIN: <strong>{company.gstin}</strong></div>
              )}
              {config.showCompanyPhone && company?.phone && (
                <div style={{ fontSize: sizes.small }}>Phone: {company.phone}</div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: sizes.heading, fontWeight: 800, color: primary, borderBottom: `2px solid ${primary}`, paddingBottom: 4 }}>
              {config.invoiceTitle || 'TAX INVOICE'}
            </div>
            <div style={{ marginTop: 8, fontSize: sizes.small }}>Invoice No: <strong>{inv.invoiceNumber}</strong></div>
            <div style={{ fontSize: sizes.small }}>Date: <strong>{formatDate(inv.invoiceDate)}</strong></div>
            {inv.dueDate && <div style={{ fontSize: sizes.small }}>Due Date: {formatDate(inv.dueDate)}</div>}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            borderBottom: isMinimal ? '1px solid #e2e8f0' : `2.5px solid ${primary}`,
            paddingBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {config.showLogo !== false && logoUrl && (
              <div
                style={{
                  background: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried && logo) {
                      target.dataset.retried = 'true';
                      target.src = `http://localhost:4000${logo.startsWith('/') ? '' : '/'}${logo}`;
                    }
                  }}
                  style={{ maxHeight: 54, maxWidth: 130, objectFit: 'contain' }}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: sizes.title, fontWeight: 800, color: isMinimal ? text : primary }}>
                {company?.name}
              </div>
              {config.showCompanyAddress && (
                <div style={{ fontSize: sizes.small, color: '#555', marginTop: 4 }}>
                  {[company?.addressLine1, company?.city, company?.state].filter(Boolean).join(', ')}
                </div>
              )}
              {config.showCompanyGstin && company?.gstin && (
                <div style={{ fontSize: sizes.small, marginTop: 2 }}>GSTIN: <strong>{company.gstin}</strong></div>
              )}
              {config.showCompanyPhone && company?.phone && (
                <div style={{ fontSize: sizes.small }}>Phone: {company.phone}</div>
              )}
              {config.showCompanyEmail && company?.email && (
                <div style={{ fontSize: sizes.small }}>Email: {company.email}</div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: sizes.heading, fontWeight: 800, color: isMinimal ? text : primary, letterSpacing: '0.04em' }}>
              {config.invoiceTitle || 'TAX INVOICE'}
            </div>
            <div style={{ marginTop: 6, fontSize: sizes.small }}>Invoice No: <strong>{inv.invoiceNumber}</strong></div>
            <div style={{ fontSize: sizes.small }}>Date: <strong>{formatDate(inv.invoiceDate)}</strong></div>
            {inv.dueDate && <div style={{ fontSize: sizes.small }}>Due Date: <strong>{formatDate(inv.dueDate)}</strong></div>}
            {config.showPaymentStatusBadge && (
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: inv.status === 'paid' ? '#dcfce7' : '#fef3c7',
                    color: inv.status === 'paid' ? '#166534' : '#92400e',
                  }}
                >
                  {inv.status}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BILL TO & PAYMENT INFO ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: accent, padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bill To
          </div>
          <div style={{ fontWeight: 700, fontSize: sizes.base + 1, color: '#0f172a' }}>{billToName}</div>
          {inv.customer?.gstin && <div style={{ fontSize: sizes.small, marginTop: 2 }}>GSTIN: {inv.customer.gstin}</div>}
          {inv.customer?.addressLine1 && <div style={{ fontSize: sizes.small, marginTop: 2 }}>{inv.customer.addressLine1}</div>}
          {inv.customer?.city && (
            <div style={{ fontSize: sizes.small }}>
              {[inv.customer.city, inv.customer.state, inv.customer.pinCode].filter(Boolean).join(', ')}
            </div>
          )}
          {(billToPhone || inv.customer?.phone) && (
            <div style={{ fontSize: sizes.small, marginTop: 2, color: '#475569' }}>
              Ph: {billToPhone || inv.customer?.phone}
            </div>
          )}
        </div>

        <div style={{ background: accent, padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Payment & Supply Info
          </div>
          <div style={{ fontSize: sizes.small }}>
            Method: <strong style={{ textTransform: 'capitalize' }}>{paymentMethod}</strong>
          </div>
          <div style={{ fontSize: sizes.small, marginTop: 4 }}>
            Status: <strong style={{ textTransform: 'capitalize', color: inv.status === 'paid' ? '#16a34a' : '#d97706' }}>{inv.status}</strong>
          </div>
          <div style={{ fontSize: sizes.small, marginTop: 4 }}>
            Supply Type: <strong>{isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</strong>
          </div>
          {inv.placeOfSupply && (
            <div style={{ fontSize: sizes.small, marginTop: 4 }}>
              Place of Supply: <strong>{inv.placeOfSupply}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ─── ITEMS TABLE ─── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: sizes.small }}>
        <thead>
          <tr
            style={{
              background: isMinimal ? '#f1f5f9' : primary,
              color: isMinimal ? text : '#ffffff',
              borderBottom: `2px solid ${isMinimal ? '#cbd5e1' : primary}`,
            }}
          >
            <th style={{ padding: '8px 10px', textAlign: 'left', width: 30 }}>#</th>
            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description</th>
            {config.showHsnCode && <th style={{ padding: '8px 10px', textAlign: 'center', width: 65 }}>HSN</th>}
            <th style={{ padding: '8px 10px', textAlign: 'center', width: 45 }}>Qty</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', width: 75 }}>Rate (₹)</th>
            {config.showDiscount && <th style={{ padding: '8px 10px', textAlign: 'right', width: 55 }}>Disc %</th>}
            <th style={{ padding: '8px 10px', textAlign: 'right', width: 75 }}>Taxable (₹)</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: 50 }}>GST %</th>
            {config.showGstBreakdown && (
              isInterState ? (
                <th style={{ padding: '8px 10px', textAlign: 'right', width: 70 }}>IGST (₹)</th>
              ) : (
                <>
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: 65 }}>CGST (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: 65 }}>SGST (₹)</th>
                </>
              )
            )}
            <th style={{ padding: '8px 10px', textAlign: 'right', width: 85 }}>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {(inv.items ?? []).map((item: any, idx: number) => (
            <tr
              key={idx}
              style={{
                background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <td style={{ padding: '6px 10px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ padding: '6px 10px', fontWeight: 500 }}>{item.description || item.product?.name}</td>
              {config.showHsnCode && <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.hsnCode || '—'}</td>}
              <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                {((item.rate || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              {config.showDiscount && (
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.discountPercent || 0}%</td>
              )}
              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                {((item.taxableAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.gstRate}%</td>
              {config.showGstBreakdown && (
                isInterState ? (
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    {((item.igstAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                ) : (
                  <>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {((item.cgstAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {((item.sgstAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </>
                )
              )}
              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>
                {((item.totalAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ─── TOTALS & BANK / REMITTANCE ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20 }}>
        <div>
          {/* Notes */}
          {displayNotes && (
            <div style={{ background: accent, padding: 10, borderRadius: 6, fontSize: sizes.small, border: '1px solid #e2e8f0', marginBottom: 8 }}>
              <strong>Notes:</strong> {displayNotes}
            </div>
          )}

          {/* Amount in Words */}
          {config.showAmountInWords && inv.amountInWords && (
            <div style={{ fontSize: sizes.small, fontStyle: 'italic', color: '#475569', marginBottom: 12 }}>
              Amount in words: <strong>{inv.amountInWords}</strong>
            </div>
          )}

          {/* Bank Details */}
          {config.showBankDetails && primaryBank && (
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 12px',
                background: accent,
                fontSize: sizes.small - 1,
                maxWidth: 320,
              }}
            >
              <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 4, fontSize: 9 }}>
                Bank & Remittance Details
              </div>
              <div>Bank: <strong>{primaryBank.bankName}</strong></div>
              <div>A/C No: <strong>{primaryBank.accountNumber}</strong></div>
              {primaryBank.ifscCode && <div>IFSC: <strong>{primaryBank.ifscCode}</strong></div>}
              {primaryBank.upiId && <div>UPI: <strong>{primaryBank.upiId}</strong></div>}
            </div>
          )}

          {/* Terms & Conditions */}
          {config.customTerms && (
            <div style={{ marginTop: 12, fontSize: sizes.small - 1, color: '#64748b', whiteSpace: 'pre-line' }}>
              <div style={{ fontWeight: 700, color: text, fontSize: sizes.small }}>Terms & Conditions:</div>
              {config.customTerms}
            </div>
          )}
        </div>

        {/* Totals Table */}
        <div style={{ minWidth: 280 }}>
          {[
            { label: 'Subtotal', value: inv.subtotal },
            (inv.discountAmount || inv.totalDiscountAmount) > 0 && {
              label: 'Discount',
              value: -(inv.discountAmount || inv.totalDiscountAmount),
            },
            { label: 'Taxable Amount', value: inv.taxableAmount },
            !isInterState && { label: 'CGST', value: inv.cgstAmount },
            !isInterState && { label: 'SGST', value: inv.sgstAmount },
            isInterState && { label: 'IGST', value: inv.igstAmount },
            inv.cessAmount > 0 && { label: 'Cess', value: inv.cessAmount },
            config.showRoundOff && inv.roundOff !== 0 && { label: 'Round Off', value: inv.roundOff },
          ]
            .filter(Boolean)
            .map((row: any, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontSize: sizes.small,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ color: '#64748b' }}>{row.label}</span>
                <span>{((row.value || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0 4px',
              fontWeight: 800,
              fontSize: sizes.heading,
              borderTop: `2px solid ${primary}`,
              color: primary,
            }}
          >
            <span>Grand Total</span>
            <span>{formatRupee(inv.grandTotal)}</span>
          </div>

          {amountPaid > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: sizes.small, color: '#16a34a' }}>
                <span>Paid Amount</span>
                <span>{formatRupee(amountPaid)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontSize: sizes.small,
                  fontWeight: 700,
                  color: balanceDue > 0 ? '#d97706' : '#16a34a',
                }}
              >
                <span>Balance Due</span>
                <span>{formatRupee(balanceDue)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── FOOTER & SIGNATORY ─── */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <div style={{ fontSize: sizes.small - 1, color: '#94a3b8' }}>
          <div>{config.footerNote || 'This is a computer-generated invoice. Generated by CloudGST Pro'}</div>
        </div>
        {config.showAuthorizedSignatory && (
          <div style={{ textAlign: 'right', fontSize: sizes.small, minWidth: 160 }}>
            {(() => {
              const sig = config.signatureImage || company?.signaturePath;
              if (sig) {
                const sigUrl = sig.startsWith('http://') || sig.startsWith('https://') || sig.startsWith('data:')
                  ? sig
                  : (sig.startsWith('/') ? sig : `/${sig}`);
                return (
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <img
                      src={sigUrl}
                      alt="Authorised Signature"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.retried && sig) {
                          target.dataset.retried = 'true';
                          target.src = `http://localhost:4000${sig.startsWith('/') ? '' : '/'}${sig}`;
                        }
                      }}
                      style={{ maxHeight: 48, maxWidth: 140, objectFit: 'contain' }}
                    />
                  </div>
                );
              }
              return <div style={{ height: 40, marginBottom: 4 }} />;
            })()}
            <div style={{ marginBottom: 2, color: '#475569', fontSize: sizes.small - 1 }}>
              {config.signatoryTitle || 'Authorised Signatory'}
            </div>
            <div style={{ borderTop: '1px solid #334155', paddingTop: 4, fontWeight: 600 }}>
              {(config.signatoryLabel || 'For {{companyName}}').replace('{{companyName}}', company?.name || 'Company')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
