import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { productApi, categoryApi, warehouseApi } from '../../api';
import toast from 'react-hot-toast';

const GST_RATES = ['0', '0.1', '0.25', '1.5', '3', '5', '12', '18', '28'] as const;

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  productCode: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  isService: z.boolean().default(false),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  gstRate: z.enum(GST_RATES).default('18'),
  taxType: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  openingStock: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  trackInventory: z.boolean().default(true),
});

type ProductForm = z.infer<typeof productSchema>;

interface Props {
  product?: any;
  categories: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({ product, categories, onClose, onSuccess }: Props) {
  const { data: unitsData } = useQuery({ queryKey: ['units'], queryFn: categoryApi.units.list });
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.list });
  const units = unitsData?.data ?? [];

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      name: product.name,
      productCode: product.productCode || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      hsnCode: product.hsnCode || '',
      isService: product.isService,
      categoryId: product.categoryId || '',
      unitId: product.unitId || '',
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      mrp: product.mrp,
      gstRate: product.gstRate as typeof GST_RATES[number],
      taxType: product.taxType,
      minStock: product.minStock,
      trackInventory: product.trackInventory,
    } : {
      gstRate: '18',
      taxType: 'exclusive',
      trackInventory: true,
    },
  });

  const isService = watch('isService');

  const mutation = useMutation({
    mutationFn: (data: ProductForm) => product
      ? productApi.update(product.id, data)
      : productApi.create(data),
    onSuccess: () => {
      toast.success(product ? 'Product updated' : 'Product created');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save product'),
  });

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Basic Info */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Basic Information</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label required">Product Name</label>
                    <input className={`form-control ${errors.name ? 'error' : ''}`} placeholder="e.g. Nike Air Max 270" {...register('name')} />
                    {errors.name && <span className="form-error">{errors.name.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Product Code</label>
                    <input className="form-control" placeholder="PROD-001" {...register('productCode')} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Barcode / EAN</label>
                    <input className="form-control" placeholder="8901234567890" {...register('barcode')} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <input className="form-control" placeholder="SKU-001" {...register('sku')} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">HSN/SAC Code</label>
                    <input className="form-control" placeholder="e.g. 6404" {...register('hsnCode')} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-control" {...register('categoryId')}>
                      <option value="">Select Category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select className="form-control" {...register('unitId')}>
                      <option value="">Select Unit</option>
                      {units.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexDirection: 'row' }}>
                    <input type="checkbox" id="isService" {...register('isService')} style={{ width: 18, height: 18 }} />
                    <label htmlFor="isService" style={{ cursor: 'pointer', fontWeight: 500 }}>This is a Service (no inventory tracking)</label>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pricing</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Purchase Price (₹)</label>
                    <div className="input-group">
                      <span className="input-prefix">₹</span>
                      <input type="number" step="0.01" className="form-control" placeholder="0.00" {...register('purchasePrice')} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Selling Price (₹)</label>
                    <div className="input-group">
                      <span className="input-prefix">₹</span>
                      <input type="number" step="0.01" className="form-control" placeholder="0.00" {...register('sellingPrice')} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">MRP (₹)</label>
                    <div className="input-group">
                      <span className="input-prefix">₹</span>
                      <input type="number" step="0.01" className="form-control" placeholder="0.00" {...register('mrp')} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">GST Rate</label>
                    <select className="form-control" {...register('gstRate')}>
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tax Type</label>
                    <select className="form-control" {...register('taxType')}>
                      <option value="exclusive">GST Exclusive (Tax added on top)</option>
                      <option value="inclusive">GST Inclusive (Tax included in price)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Inventory (only for products, not services) */}
              {!isService && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Inventory
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {!product && (
                      <div className="form-group">
                        <label className="form-label">Opening Stock</label>
                        <input type="number" className="form-control" placeholder="0" {...register('openingStock')} />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Minimum Stock (Alert)</label>
                      <input type="number" className="form-control" placeholder="0" {...register('minStock')} />
                      <span className="form-hint">Get alerted when stock falls below this</span>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexDirection: 'row', gridColumn: '1 / -1' }}>
                      <input type="checkbox" id="trackInventory" {...register('trackInventory')} style={{ width: 18, height: 18 }} />
                      <label htmlFor="trackInventory" style={{ cursor: 'pointer', fontWeight: 500 }}>Track inventory (deduct stock on sale)</label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
