import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Tag, Plus, Edit2, Trash2, X, Loader2, ChevronRight,
  Package, Layers, Ruler, Box
} from 'lucide-react';
import { categoryApi } from '../../api';
import api from '../../api';
import toast from 'react-hot-toast';

// ── Extra API helpers ──────────────────────────────────
const brandApi = {
  list: () => api.get('/categories/brands').then(r => r.data),
  create: (data: any) => api.post('/categories/brands', data).then(r => r.data),
  delete: (id: string) => api.delete(`/categories/brands/${id}`).then(r => r.data),
};
const unitApi = {
  list: () => api.get('/categories/units').then(r => r.data),
  create: (data: any) => api.post('/categories/units', data).then(r => r.data),
  delete: (id: string) => api.delete(`/categories/units/${id}`).then(r => r.data),
};

// ── Schemas ────────────────────────────────────────────
const catSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
});
const brandSchema = z.object({ name: z.string().min(1, 'Name is required'), description: z.string().optional() });
const unitSchema = z.object({ name: z.string().min(1), abbreviation: z.string().min(1, 'Abbreviation required') });

type CatForm = z.infer<typeof catSchema>;
type BrandForm = z.infer<typeof brandSchema>;
type UnitForm = z.infer<typeof unitSchema>;

// ── Category Modal ─────────────────────────────────────
function CategoryModal({
  editing, categories, onClose, onSuccess,
}: { editing?: any; categories: any[]; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CatForm>({
    resolver: zodResolver(catSchema),
    defaultValues: editing ? { name: editing.name, description: editing.description || '', parentId: editing.parentId || '' } : {},
  });

  const mutation = useMutation({
    mutationFn: (data: CatForm) => {
      // Only include parentId and description if they have real values
      // (Zod's z.string().optional() rejects null — only accepts string | undefined)
      const payload: Record<string, any> = { name: data.name };
      if (data.parentId && data.parentId.trim()) payload.parentId = data.parentId;
      if (data.description && data.description.trim()) payload.description = data.description.trim();
      return editing
        ? api.put(`/categories/${editing.id}`, payload).then(r => r.data)
        : categoryApi.create(payload);
    },
    onSuccess: () => { toast.success(editing ? 'Category updated!' : 'Category created!'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editing ? 'Edit Category' : 'New Category'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Category Name</label>
                <input className={`form-control ${errors.name ? 'error' : ''}`} placeholder="e.g. Sports Equipment" {...register('name')} />
                {errors.name && <span className="form-error">{errors.name.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Parent Category <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>(optional — for sub-categories)</span></label>
                <select className="form-control" {...register('parentId')}>
                  <option value="">None (Top-level)</option>
                  {categories.filter(c => !editing || c.id !== editing.id).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={2} placeholder="Optional description" {...register('description')} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Inline quick-add row ───────────────────────────────
function QuickAddRow({ onAdd, placeholder, extraField }: {
  onAdd: (data: any) => Promise<void>;
  placeholder: string;
  extraField?: { name: string; placeholder: string };
}) {
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    if (extraField && !extra.trim()) { toast.error(`${extraField.placeholder} is required`); return; }
    setLoading(true);
    try {
      await onAdd({ name, ...(extraField ? { [extraField.name]: extra } : {}) });
      setName(''); setExtra('');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
      <input className="form-control" placeholder={placeholder} value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()} style={{ flex: 2 }} />
      {extraField && (
        <input className="form-control" placeholder={extraField.placeholder} value={extra} onChange={e => setExtra(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} style={{ flex: 1 }} />
      )}
      <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={loading}>
        {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={14} />} Add
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────
export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'categories' | 'brands' | 'units'>('categories');
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);

  const { data: catsData, isLoading: catsLoading } = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list });
  const { data: brandsData, isLoading: brandsLoading } = useQuery({ queryKey: ['brands'], queryFn: brandApi.list });
  const { data: unitsData, isLoading: unitsLoading } = useQuery({ queryKey: ['units'], queryFn: unitApi.list });

  const categories: any[] = catsData?.data ?? [];
  const brands: any[] = brandsData?.data ?? [];
  const units: any[] = unitsData?.data ?? [];

  const deleteCat = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success('Category deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Cannot delete'),
  });
  const deleteBrand = useMutation({
    mutationFn: brandApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['brands'] }); toast.success('Brand deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Cannot delete'),
  });
  const deleteUnit = useMutation({
    mutationFn: unitApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); toast.success('Unit deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Cannot delete'),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    setShowModal(false); setEditingCat(null);
  };

  // Separate top-level and sub-categories
  const topLevel = categories.filter(c => !c.parentId);
  const getSubs = (parentId: string) => categories.filter(c => c.parentId === parentId);

  const TABS = [
    { id: 'categories', label: 'Categories', icon: Layers, count: categories.length },
    { id: 'brands', label: 'Brands', icon: Tag, count: brands.length },
    { id: 'units', label: 'Units of Measure', icon: Ruler, count: units.length },
  ] as const;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Product Catalogue Setup</h1>
          <p className="page-subtitle">Manage categories, brands, and units of measure</p>
        </div>
        {tab === 'categories' && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => { setEditingCat(null); setShowModal(true); }}>
              <Plus size={16} /> New Category
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6, color: tab === id ? 'var(--brand-primary)' : 'var(--color-text-muted)', borderBottom: tab === id ? '2px solid var(--brand-primary)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' }}>
            <Icon size={15} /> {label}
            <span style={{ background: tab === id ? 'var(--brand-primary)' : 'var(--color-surface-raised)', color: tab === id ? 'white' : 'var(--color-text-dim)', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {catsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="card"><div className="skeleton" style={{ height: 20, width: '60%' }} /></div>)
          ) : categories.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                <div className="empty-state-icon"><Layers size={40} /></div>
                <div className="empty-state-title">No categories yet</div>
                <div className="empty-state-message">Create categories to organise your products</div>
                <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowModal(true)}>
                  <Plus size={16} /> Create First Category
                </button>
              </div>
            </div>
          ) : topLevel.map(cat => {
            const subs = getSubs(cat.id);
            return (
              <div key={cat.id} className="card" style={{ padding: 0 }}>
                {/* Parent row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', gap: 'var(--space-3)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-lg)', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', flexShrink: 0 }}>
                    <Layers size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{cat.name}</div>
                    {cat.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{cat.description}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', background: 'var(--color-surface-raised)', borderRadius: 99, padding: '2px 10px' }}>
                      {cat._count?.products ?? 0} products
                    </span>
                    {subs.length > 0 && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', background: 'var(--color-surface-raised)', borderRadius: 99, padding: '2px 10px' }}>
                        {subs.length} sub-cats
                      </span>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingCat(cat); setShowModal(true); }}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
                      onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteCat.mutate(cat.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub-categories */}
                {subs.map((sub, idx) => (
                  <div key={sub.id} style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', gap: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)', background: 'var(--color-surface-raised)', marginLeft: 0 }}>
                    <div style={{ width: 20, display: 'flex', justifyContent: 'center', color: 'var(--color-text-dim)' }}>
                      <ChevronRight size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{sub.name}</div>
                      {sub.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{sub.description}</div>}
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', background: 'var(--color-surface)', borderRadius: 99, padding: '2px 8px', border: '1px solid var(--color-border-light)' }}>
                      {sub._count?.products ?? 0} products
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingCat(sub); setShowModal(true); }}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
                      onClick={() => { if (confirm(`Delete "${sub.name}"?`)) deleteCat.mutate(sub.id); }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── BRANDS TAB ── */}
      {tab === 'brands' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Brands</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{brands.length} brands</span>
          </div>
          {brandsLoading ? <div style={{ padding: 'var(--space-6)' }}><div className="skeleton" style={{ height: 18, width: '50%' }} /></div>
            : brands.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon"><Tag size={32} /></div>
                <div className="empty-state-title">No brands yet</div>
              </div>
            ) : (
              <div>
                {brands.map((b: any) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--color-border-light)', gap: 'var(--space-3)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tag size={15} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{b.name}</div>
                      {b.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{b.description}</div>}
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
                      onClick={() => { if (confirm(`Delete "${b.name}"?`)) deleteBrand.mutate(b.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          <QuickAddRow
            placeholder="Brand name (e.g. Nike, Adidas)"
            onAdd={async (data) => {
              await brandApi.create(data);
              queryClient.invalidateQueries({ queryKey: ['brands'] });
              toast.success('Brand added!');
            }}
          />
        </div>
      )}

      {/* ── UNITS TAB ── */}
      {tab === 'units' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Units of Measure</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{units.length} units</span>
          </div>
          {unitsLoading ? <div style={{ padding: 'var(--space-6)' }}><div className="skeleton" style={{ height: 18, width: '40%' }} /></div>
            : units.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon"><Ruler size={32} /></div>
                <div className="empty-state-title">No units yet</div>
                <div className="empty-state-message">e.g. Pieces, Kg, Litres, Metres</div>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Unit Name</th><th>Abbreviation</th><th style={{ width: 60 }}></th></tr></thead>
                <tbody>
                  {units.map((u: any) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td><span style={{ fontFamily: 'monospace', background: 'var(--color-surface-raised)', borderRadius: 4, padding: '2px 8px', fontSize: 'var(--text-sm)' }}>{u.abbreviation}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
                          onClick={() => { if (confirm(`Delete "${u.name}"?`)) deleteUnit.mutate(u.id); }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <QuickAddRow
            placeholder="Unit name (e.g. Pieces)"
            extraField={{ name: 'abbreviation', placeholder: 'Abbr (e.g. pcs)' }}
            onAdd={async (data) => {
              await unitApi.create(data);
              queryClient.invalidateQueries({ queryKey: ['units'] });
              toast.success('Unit added!');
            }}
          />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CategoryModal
          editing={editingCat}
          categories={categories}
          onClose={() => { setShowModal(false); setEditingCat(null); }}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
