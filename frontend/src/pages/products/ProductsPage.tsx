import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Package, Edit2, Trash2, Barcode, AlertTriangle, Filter, Download } from 'lucide-react';
import { productApi, categoryApi, warehouseApi } from '../../api';
import { exportProducts } from '../../utils/excelExport';
import toast from 'react-hot-toast';
import ProductModal from './ProductModal';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, categoryId, filter],
    queryFn: () => productApi.list({ page, limit: 20, search, categoryId: categoryId || undefined, lowStock: filter === 'low', outOfStock: filter === 'out' }),
  });

  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deactivated'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const products = data?.data ?? [];
  const pagination = data?.pagination;
  const categories = categoriesData?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} products in inventory</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={async () => {
            try {
              const all = await productApi.list({ limit: 1000 });
              await exportProducts(all.data, 'Products.xlsx');
            } catch { toast.error('Export failed'); }
          }}><Download size={16} /> Export Excel</button>
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true); }}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
            <input placeholder="Search products, barcode, SKU..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ width: 'auto' }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>HSN Code</th>
                <th>GST Rate</th>
                <th style={{ textAlign: 'right' }}>Purchase Price</th>
                <th style={{ textAlign: 'right' }}>Selling Price</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><Package size={32} /></div>
                      <div className="empty-state-title">No products found</div>
                      <div className="empty-state-message">Add your first product to get started</div>
                      <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Product</button>
                    </div>
                  </td>
                </tr>
              ) : products.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>
                        {p.productCode && <span style={{ marginRight: 8 }}>#{p.productCode}</span>}
                        {p.barcode && <><Barcode size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {p.barcode}</>}
                      </span>
                    </div>
                  </td>
                  <td><span className="text-muted text-sm">{p.category?.name ?? '—'}</span></td>
                  <td><span className="text-sm">{p.hsnCode ?? '—'}</span></td>
                  <td><span className="badge badge-info">{p.gstRate}%</span></td>
                  <td style={{ textAlign: 'right' }}>₹{Number(p.purchasePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {p.totalStock <= 0 ? (
                        <span className="badge badge-danger">Out of stock</span>
                      ) : p.totalStock <= p.minStock ? (
                        <span className="badge badge-warning"><AlertTriangle size={10} /> {p.totalStock} {p.unit?.abbreviation}</span>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{p.totalStock} {p.unit?.abbreviation}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${p.isActive ? 'badge-success' : 'badge-default'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditProduct(p); setShowModal(true); }} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Deactivate "${p.name}"?`)) deleteMutation.mutate(p.id); }} title="Deactivate" style={{ color: 'var(--color-danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn btn-secondary btn-sm" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          onClose={() => { setShowModal(false); setEditProduct(null); }}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); setEditProduct(null); }}
        />
      )}
    </div>
  );
}
