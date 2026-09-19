import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Plus, Minus, Search, Tag } from 'lucide-react';
import { productApi } from '../../api';
import QRCode from 'qrcode';

interface LabelItem {
  product: any;
  quantity: number;
}

const LABEL_SIZES = [
  { id: '38x25', label: '38×25 mm (Small)', w: 38, h: 25 },
  { id: '50x25', label: '50×25 mm (Medium)', w: 50, h: 25 },
  { id: '58x40', label: '58×40 mm (Large)', w: 58, h: 40 },
  { id: '100x50', label: '100×50 mm (Wide)', w: 100, h: 50 },
];

export default function BarcodeLabelPage() {
  const [search, setSearch] = useState('');
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [labelSize, setLabelSize] = useState(LABEL_SIZES[1]);
  const [showPrice, setShowPrice] = useState(true);
  const [showCompany, setShowCompany] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: productsData } = useQuery({
    queryKey: ['barcode-products', search],
    queryFn: () => productApi.list({ search, limit: 20 }),
    enabled: search.length > 0,
  });
  const products = productsData?.data ?? [];

  const addProduct = (product: any) => {
    const existing = labelItems.find(li => li.product.id === product.id);
    if (existing) {
      setLabelItems(prev => prev.map(li => li.product.id === product.id ? { ...li, quantity: li.quantity + 1 } : li));
    } else {
      setLabelItems(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  const totalLabels = labelItems.reduce((sum, li) => sum + li.quantity, 0);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <title>Barcode Labels</title>
        <style>
          @page { margin: 4mm; }
          body { margin: 0; padding: 0; font-family: 'Courier New', monospace; }
          .label-grid { display: flex; flex-wrap: wrap; gap: 2mm; }
          .label { 
            width: ${labelSize.w}mm; height: ${labelSize.h}mm; 
            border: 0.5pt solid #ccc; 
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 1.5mm; box-sizing: border-box; overflow: hidden;
            page-break-inside: avoid;
          }
          .company { font-size: 5pt; font-weight: bold; color: #333; margin-bottom: 1mm; text-align: center; }
          .product-name { font-size: ${labelSize.h > 30 ? '7' : '5.5'}pt; font-weight: bold; text-align: center; margin-bottom: 1mm; line-height: 1.2; }
          .barcode-img { max-width: 90%; height: auto; max-height: 40%; }
          .barcode-num { font-size: 5pt; letter-spacing: 1pt; margin-top: 0.5mm; }
          .price { font-size: ${labelSize.h > 30 ? '9' : '7'}pt; font-weight: bold; margin-top: 1mm; }
          .sku { font-size: 4.5pt; color: #666; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };



  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Barcode Label Printing</h1>
          <p className="page-subtitle">Generate and print product barcode labels</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handlePrint} disabled={labelItems.length === 0}>
            <Printer size={16} /> Print {totalLabels > 0 ? `${totalLabels} Labels` : 'Labels'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Label Settings */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Label Settings</div>
            <div className="form-group">
              <label className="form-label">Label Size</label>
              <select className="form-control" value={labelSize.id} onChange={(e) => setLabelSize(LABEL_SIZES.find(s => s.id === e.target.value) || LABEL_SIZES[1])}>
                {LABEL_SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[
                { label: 'Show Selling Price', checked: showPrice, setter: setShowPrice },
                { label: 'Show Company Name', checked: showCompany, setter: setShowCompany },
              ].map(({ label, checked, setter }) => (
                <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={checked} onChange={(e) => setter(e.target.checked)} style={{ width: 16, height: 16 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Product Search */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Add Products</div>
            <div className="search-input" style={{ marginBottom: 'var(--space-3)' }}>
              <Search size={14} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
              <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: 280, overflowY: 'auto' }}>
              {products.map((p: any) => (
                <button key={p.id} type="button" className="dropdown-item" onClick={() => addProduct(p)}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{p.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{p.barcode || 'No barcode'} • ₹{(p.sellingPrice / 100).toLocaleString('en-IN')}</div>
                  </div>
                </button>
              ))}
              {search && products.length === 0 && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-dim)', textAlign: 'center', padding: 'var(--space-3)' }}>No products found</div>}
            </div>
          </div>

          {/* Selected Items */}
          {labelItems.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Selected ({totalLabels} labels)</div>
              {labelItems.map((li) => (
                <div key={li.product.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <div style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.product.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => {
                      if (li.quantity <= 1) setLabelItems(prev => prev.filter(x => x.product.id !== li.product.id));
                      else setLabelItems(prev => prev.map(x => x.product.id === li.product.id ? { ...x, quantity: x.quantity - 1 } : x));
                    }}><Minus size={12} /></button>
                    <span style={{ fontWeight: 700, width: 28, textAlign: 'center', fontSize: 'var(--text-sm)' }}>{li.quantity}</span>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setLabelItems(prev => prev.map(x => x.product.id === li.product.id ? { ...x, quantity: x.quantity + 1 } : x))}><Plus size={12} /></button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', marginTop: 'var(--space-2)' }} onClick={() => setLabelItems([])}>Clear All</button>
            </div>
          )}
        </div>

        {/* Right: Label Preview */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Label Preview</div>
          {labelItems.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
              <div className="empty-state-icon"><Tag size={36} /></div>
              <div className="empty-state-title">No labels added</div>
              <div className="empty-state-message">Search and add products to generate labels</div>
            </div>
          ) : (
            <div>
              <div ref={printRef}>
                <div className="label-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {labelItems.flatMap((li) =>
                    Array.from({ length: li.quantity }).map((_, i) => (
                      <div key={`${li.product.id}-${i}`}
                        style={{ width: `${labelSize.w * 2.83}px`, height: `${labelSize.h * 2.83}px`, border: '1px solid #ccc', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6, boxSizing: 'border-box', background: 'white', gap: 3 }}>
                        {showCompany && <div style={{ fontSize: 7, fontWeight: 700, color: '#333', textAlign: 'center' }}>CloudGST Pro</div>}
                        <div style={{ fontSize: labelSize.h > 30 ? 9 : 7, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {li.product.name}
                        </div>
                        <SimpleBarcodeDisplay code={li.product.barcode || li.product.productCode || li.product.id.slice(-8)} />
                        {showPrice && (
                          <div style={{ fontSize: labelSize.h > 30 ? 11 : 8, fontWeight: 800, color: '#1A56DB' }}>
                            ₹{(li.product.sellingPrice / 100).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

}

function SimpleBarcodeDisplay({ code }: { code: string }) {
  if (!code) return null;
  const bars = code.split('').flatMap((char, i) => {
    const w = (char.charCodeAt(0) % 3) + 1;
    return [{ type: 'bar', width: w, key: `b${i}` }, { type: 'space', width: 1, key: `s${i}` }];
  });
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 24, gap: 0 }}>
        {bars.map(b => (
          <div key={b.key} style={{ width: b.width, background: b.type === 'bar' ? '#000' : 'transparent', height: '100%', display: 'inline-block' }} />
        ))}
      </div>
      <div style={{ fontSize: 6, letterSpacing: 1, fontFamily: 'Courier New', marginTop: 1 }}>{code.slice(0, 14)}</div>
    </div>
  );
}

