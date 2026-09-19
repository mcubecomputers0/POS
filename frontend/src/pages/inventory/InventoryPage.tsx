import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, ClipboardList, Plus, X, Loader2 } from 'lucide-react';
import { productApi, warehouseApi } from '../../api';
import api from '../../api';
import toast from 'react-hot-toast';

// ─── Stock Adjustment API ───────────────────────────────
const stockApi = {
  adjust: (data: any) => api.post('/products/stock-adjust', data).then(r => r.data),
  movements: (params?: any) => api.get('/products/stock-movements', { params }).then(r => r.data),
};

// ─── Stock Adjustment Modal ─────────────────────────────
const adjustSchema = z.object({
  productId: z.string().min(1, 'Product required'),
  warehouseId: z.string().min(1, 'Warehouse required'),
  type: z.enum(['in', 'out', 'adjustment', 'opening']),
  quantity: z.coerce.number().min(0.001, 'Quantity must be > 0'),
  rate: z.coerce.number().min(0).optional(),
  reason: z.string().min(1, 'Reason required'),
  notes: z.string().optional(),
  date: z.string().min(1),
});

type AdjustForm = z.infer<typeof adjustSchema>;

function StockAdjustModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: productsData } = useQuery({ queryKey: ['products-all'], queryFn: () => productApi.list({ limit: 200 }) });
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.list });
  const products = productsData?.data ?? [];
  const warehouses = warehousesData?.data ?? [];

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: 'in', date: new Date().toISOString().split('T')[0] },
  });

  const mutation = useMutation({
    mutationFn: stockApi.adjust,
    onSuccess: () => { toast.success('Stock adjusted successfully'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const adjustType = watch('type');
  const typeColors: Record<string, string> = {
    in: 'var(--color-success)', out: 'var(--color-danger)',
    adjustment: 'var(--color-warning)', opening: 'var(--brand-primary)',
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Stock Adjustment</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((data) => mutation.mutate({ ...data, quantity: data.type === 'out' ? -data.quantity : data.quantity }))}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Adjustment Type</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {([
                    { value: 'in', label: '↑ Stock In', icon: ArrowUpCircle },
                    { value: 'out', label: '↓ Stock Out', icon: ArrowDownCircle },
                    { value: 'adjustment', label: '⚖ Adjustment', icon: ClipboardList },
                  ] as const).map(({ value, label }) => (
                    <label key={value} style={{ flex: 1, cursor: 'pointer' }}>
                      <input type="radio" value={value} {...register('type')} style={{ display: 'none' }} />
                      <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)', border: `2px solid ${adjustType === value ? typeColors[value] : 'var(--color-border)'}`, background: adjustType === value ? `${typeColors[value]}15` : 'var(--color-surface)', textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: adjustType === value ? 700 : 400, color: adjustType === value ? typeColors[value] : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
                        {label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label required">Product</label>
                  <select className={`form-control ${errors.productId ? 'error' : ''}`} {...register('productId')}>
                    <option value="">Select product...</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.productCode || p.id.slice(0, 8)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Warehouse</label>
                  <select className={`form-control ${errors.warehouseId ? 'error' : ''}`} {...register('warehouseId')}>
                    <option value="">Select warehouse...</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Default)' : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Date</label>
                  <input type="date" className="form-control" {...register('date')} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Quantity</label>
                  <input type="number" step="0.001" className={`form-control ${errors.quantity ? 'error' : ''}`} placeholder="0" {...register('quantity')} />
                  {errors.quantity && <span className="form-error">{errors.quantity.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Rate / Cost (₹)</label>
                  <div className="input-group"><span className="input-prefix">₹</span><input type="number" step="0.01" className="form-control" placeholder="0.00" {...register('rate')} /></div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label required">Reason</label>
                  <input className={`form-control ${errors.reason ? 'error' : ''}`} placeholder="e.g. Physical count correction, Damaged goods, Transfer..." {...register('reason')} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={2} {...register('notes')} />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              Save Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Inventory Page ────────────────────────────────
export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [showAdjust, setShowAdjust] = useState(false);
  const [movementFilter, setMovementFilter] = useState({ productId: '', type: '', limit: 50 });

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['inventory-stock'],
    queryFn: () => productApi.list({ limit: 200, trackInventory: true }),
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements', movementFilter],
    queryFn: () => stockApi.movements(movementFilter),
    enabled: tab === 'movements',
  });

  const products = stockData?.data ?? [];
  const movements = movementsData?.data ?? [];

  // Categorize stock levels
  const outOfStock = products.filter((p: any) => p.totalStock <= 0);
  const lowStock = products.filter((p: any) => p.totalStock > 0 && p.totalStock <= p.minStock && p.minStock > 0);
  const healthy = products.filter((p: any) => p.totalStock > p.minStock || p.minStock === 0);

  const TYPE_BADGE: Record<string, string> = {
    in: 'badge-success', out: 'badge-danger', sale: 'badge-danger',
    purchase: 'badge-success', adjustment: 'badge-warning', return: 'badge-info',
    opening: 'badge-primary',
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Stock levels, movements, and adjustments</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAdjust(true)}>
            <Plus size={16} /> Stock Adjustment
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card" style={{ border: '1px solid var(--color-success)30' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Healthy Stock</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-display)' }}>{healthy.length}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
              <Package size={24} />
            </div>
          </div>
        </div>
        <div className="card" style={{ border: '1px solid var(--color-warning)30' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Low Stock</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-warning)', fontFamily: 'var(--font-display)' }}>{lowStock.length}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
        <div className="card" style={{ border: '1px solid var(--color-danger)30' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Out of Stock</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'var(--font-display)' }}>{outOfStock.length}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
              <Package size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {(['stock', 'movements'] as const).map((t) => (
          <button key={t} style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', color: tab === t ? 'var(--brand-primary)' : 'var(--color-text-muted)', borderBottom: tab === t ? '2px solid var(--brand-primary)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s', textTransform: 'capitalize' }} onClick={() => setTab(t)}>
            {t === 'stock' ? '📦 Stock Levels' : '📋 Movements'}
          </button>
        ))}
      </div>

      {/* Stock Levels Tab */}
      {tab === 'stock' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th><th>SKU / Code</th><th>Category</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right' }}>Min Stock</th>
                  <th style={{ textAlign: 'right' }}>Purchase Price</th>
                  <th style={{ textAlign: 'right' }}>Stock Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stockLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>)
                ) : products.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-title">No products with inventory tracking</div></div></td></tr>
                ) : products.map((p: any) => {
                  const stock = p.totalStock ?? 0;
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && p.minStock > 0 && stock <= p.minStock;
                  const stockValue = stock * (p.purchasePrice / 100);
                  return (
                    <tr key={p.id}>
                      <td><div style={{ fontWeight: 500 }}>{p.name}</div>{p.barcode && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>🔖 {p.barcode}</div>}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{p.productCode || '—'}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{p.category?.name || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isOut ? 'var(--color-danger)' : isLow ? 'var(--color-warning)' : 'var(--color-success)', fontSize: 'var(--text-base)' }}>
                        {stock} <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{p.unit?.abbreviation}</span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{p.minStock || '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }}>₹{(p.purchasePrice / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td>
                        {isOut ? <span className="badge badge-danger">Out of Stock</span>
                          : isLow ? <span className="badge badge-warning"><AlertTriangle size={10} /> Low Stock</span>
                          : <span className="badge badge-success">In Stock</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movements Tab */}
      {tab === 'movements' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <select className="form-control" style={{ width: 'auto' }} value={movementFilter.type} onChange={(e) => setMovementFilter(prev => ({ ...prev, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="in">Stock In</option><option value="out">Stock Out</option>
                <option value="sale">Sale</option><option value="purchase">Purchase</option>
                <option value="adjustment">Adjustment</option><option value="return">Return</option>
                <option value="opening">Opening</option>
              </select>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th><th>Type</th><th>Qty</th><th>Before</th><th>After</th>
                    <th>Warehouse</th><th>Reference</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>)
                  ) : movements.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-title">No stock movements yet</div><div className="empty-state-message">Create invoices or purchases to see movements here</div></div></td></tr>
                  ) : movements.map((m: any) => (
                    <tr key={m.id}>
                      <td><div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{m.product?.name}</div></td>
                      <td><span className={`badge ${TYPE_BADGE[m.type] || 'badge-default'}`}>{m.type}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: m.quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{m.beforeQty}</td>
                      <td style={{ textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{m.afterQty}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{m.warehouse?.name || '—'}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{m.reference || '—'}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{new Date(m.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAdjust && (
        <StockAdjustModal
          onClose={() => setShowAdjust(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['inventory-stock'] }); queryClient.invalidateQueries({ queryKey: ['stock-movements'] }); setShowAdjust(false); }}
        />
      )}
    </div>
  );
}
