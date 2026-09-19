import { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Loader2, Search, Save } from 'lucide-react';
import { purchaseApi, supplierApi, productApi, warehouseApi } from '../../api';
import { TaxService } from '../../utils/taxUtils';
import toast from 'react-hot-toast';

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, 'Required'),
  hsnCode: z.string().optional(),
  quantity: z.coerce.number().min(0.001, 'Required'),
  unit: z.string().optional(),
  rate: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.enum(['0','0.1','0.25','1.5','3','5','12','18','28']).default('18'),
  warehouseId: z.string().optional(),
});

const schema = z.object({
  supplierId: z.string().optional(),
  isInterState: z.boolean().default(false),
  purchaseDate: z.string().min(1),
  expectedDelivery: z.string().optional(),
  referenceNumber: z.string().optional(),
  paymentMethod: z.enum(['cash','bank_transfer','upi','card','cheque','credit']).default('credit'),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item required'),
  invoiceDiscountPercent: z.coerce.number().min(0).max(100).default(0),
});

type Form = z.infer<typeof schema>;

const GST_RATES = ['0','0.1','0.25','1.5','3','5','12','18','28'];

export default function CreatePurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      purchaseDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'credit',
      isInterState: false,
      invoiceDiscountPercent: 0,
      items: [{ description: '', quantity: 1, rate: 0, discountPercent: 0, gstRate: '18' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-search', supplierSearch],
    queryFn: () => supplierApi.list({ search: supplierSearch, limit: 10 }),
    enabled: supplierSearch.length >= 1,
  });

  const { data: warehousesData } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.list });
  const warehouses = warehousesData?.data ?? [];
  const defaultWarehouse = warehouses.find((w: any) => w.isDefault);

  const watchItems = watch('items');
  const watchIsInterState = watch('isInterState');
  const watchDiscount = watch('invoiceDiscountPercent');

  // Live tax calculation
  const taxItems = watchItems.map((item) => ({
    description: item.description || '',
    quantity: String(item.quantity || 0),
    rate: Math.round((item.rate || 0) * 100),
    discountPercent: String(item.discountPercent || 0),
    gstRate: item.gstRate || '18',
    cessRate: '0',
    taxType: 'exclusive' as const,
  }));
  const taxResult = taxItems.length > 0 && taxItems.some(i => i.quantity !== '0')
    ? TaxService.calculate(taxItems, { isInterState: watchIsInterState, invoiceDiscountPercent: String(watchDiscount || 0) })
    : null;

  const mutation = useMutation({
    mutationFn: (data: Form) => purchaseApi.create({
      ...data,
      supplierId: selectedSupplier?.id ?? null,
      items: data.items.map(item => ({
        ...item,
        rate: Math.round(item.rate * 100),
        warehouseId: item.warehouseId || defaultWarehouse?.id,
      })),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success(`Purchase order ${res.data.purchaseNumber} created!`);
      navigate('/purchases');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create purchase'),
  });

  const formatRupee = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">New Purchase Order</h1>
          <p className="page-subtitle">Record a purchase from a supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-5)', alignItems: 'start' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header Info */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Purchase Details</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Supplier */}
                <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                  <label className="form-label">Supplier</label>
                  {selectedSupplier ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-primary)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{selectedSupplier.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{selectedSupplier.gstin || selectedSupplier.phone || ''}</div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedSupplier(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="search-input">
                        <Search size={14} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
                        <input
                          placeholder="Search supplier..."
                          value={supplierSearch}
                          onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                          onFocus={() => setShowSupplierDropdown(true)}
                        />
                      </div>
                      {showSupplierDropdown && (suppliersData?.data ?? []).length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', marginTop: 4 }}>
                          {(suppliersData?.data ?? []).map((s: any) => (
                            <button key={s.id} type="button" className="dropdown-item" style={{ width: '100%' }} onClick={() => { setSelectedSupplier(s); setSupplierSearch(''); setShowSupplierDropdown(false); }}>
                              <div><div style={{ fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{s.gstin || s.phone}</div></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label required">Purchase Date</label>
                  <input type="date" className="form-control" {...register('purchaseDate')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Delivery</label>
                  <input type="date" className="form-control" {...register('expectedDelivery')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Supplier Invoice No.</label>
                  <input className="form-control" placeholder="Supplier's invoice number" {...register('referenceNumber')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <select className="form-control" {...register('paymentMethod')}>
                    <option value="credit">Credit</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
                  <input type="checkbox" id="isInterState" {...register('isInterState')} style={{ width: 18, height: 18 }} />
                  <label htmlFor="isInterState" style={{ cursor: 'pointer', fontWeight: 500 }}>Inter-State (IGST applies)</label>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>Purchase Items</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => append({ description: '', quantity: 1, rate: 0, discountPercent: 0, gstRate: '18' })}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, width: 30 }}>#</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, minWidth: 200 }}>Description</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, width: 80 }}>HSN</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, width: 80 }}>Qty</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, width: 110 }}>Rate (₹)</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, width: 80 }}>Disc %</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, width: 90 }}>GST %</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, width: 130 }}>Warehouse</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, width: 110 }}>Total (₹)</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const item = watchItems[idx] || {};
                      const itemTotal = ((item.quantity || 0) * (item.rate || 0) * (1 - (item.discountPercent || 0) / 100));
                      const gstAmt = itemTotal * (parseFloat(item.gstRate || '0') / 100);
                      return (
                        <tr key={field.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '8px', color: 'var(--color-text-dim)', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: '4px 6px' }}>
                            <input className="form-control" style={{ fontSize: 'var(--text-sm)' }} placeholder="Item description" {...register(`items.${idx}.description`)} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input className="form-control" style={{ fontSize: 'var(--text-sm)' }} placeholder="HSN" {...register(`items.${idx}.hsnCode`)} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" step="0.001" className="form-control" style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.quantity`)} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" step="0.01" className="form-control" style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.rate`)} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" step="0.01" className="form-control" style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.discountPercent`)} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <select className="form-control" style={{ fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.gstRate`)}>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <select className="form-control" style={{ fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.warehouseId`)}>
                              <option value="">Default</option>
                              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--brand-primary)' }}>
                            ₹{(itemTotal + gstAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: 4 }} onClick={() => fields.length > 1 && remove(idx)} disabled={fields.length === 1}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="card">
              <div className="form-group">
                <label className="form-label">Internal Notes</label>
                <textarea className="form-control" rows={2} placeholder="Notes for this purchase order..." {...register('notes')} />
              </div>
            </div>
          </div>

          {/* Right Column — Summary */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Order Summary</div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Invoice Discount %</label>
                <input type="number" step="0.01" className="form-control" placeholder="0" {...register('invoiceDiscountPercent')} />
              </div>

              {taxResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  {[
                    { label: 'Subtotal', value: taxResult.subtotal },
                    taxResult.totalDiscountAmount > 0 && { label: 'Discount', value: -taxResult.totalDiscountAmount },
                    { label: 'Taxable Amount', value: taxResult.taxableAmount },
                    !watchIsInterState && taxResult.cgstAmount > 0 && { label: 'CGST', value: taxResult.cgstAmount },
                    !watchIsInterState && taxResult.sgstAmount > 0 && { label: 'SGST', value: taxResult.sgstAmount },
                    watchIsInterState && taxResult.igstAmount > 0 && { label: 'IGST', value: taxResult.igstAmount },
                    taxResult.roundOff !== 0 && { label: 'Round Off', value: taxResult.roundOff },
                  ].filter(Boolean).map((row: any, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', paddingBottom: 'var(--space-1)', borderBottom: '1px solid var(--color-border-light)', color: row.label === 'Discount' ? 'var(--color-success)' : 'inherit' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                      <span style={{ fontWeight: 500 }}>{formatRupee(Math.abs(row.value))}{row.label === 'Discount' ? ' off' : ''}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 'var(--text-lg)', paddingTop: 'var(--space-2)', color: 'var(--brand-primary)' }}>
                    <span>Grand Total</span>
                    <span>{formatRupee(taxResult.grandTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>
                    <span>Total Tax</span>
                    <span>{formatRupee(taxResult.totalTax)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-dim)', fontSize: 'var(--text-sm)' }}>
                  Add items to see totals
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : <><Save size={14} /> Save Purchase Order</>}
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/purchases')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
