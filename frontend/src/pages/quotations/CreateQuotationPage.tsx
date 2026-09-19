import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Loader2, Search, Save, Send } from 'lucide-react';
import { quotationApi, customerApi } from '../../api';
import { TaxService } from '../../utils/taxUtils';
import toast from 'react-hot-toast';

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, 'Required'),
  hsnCode: z.string().optional(),
  quantity: z.coerce.number().min(0.001),
  unit: z.string().optional(),
  rate: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.enum(['0','0.1','0.25','1.5','3','5','12','18','28']).default('18'),
});

const schema = z.object({
  customerId: z.string().optional(),
  isInterState: z.boolean().default(false),
  quotationDate: z.string().min(1),
  validUntil: z.string().optional(),
  subject: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(itemSchema).min(1),
  invoiceDiscountPercent: z.coerce.number().min(0).max(100).default(0),
});

type Form = z.infer<typeof schema>;
const GST_RATES = ['0','0.1','0.25','1.5','3','5','12','18','28'];

export default function CreateQuotationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      quotationDate: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      isInterState: false,
      invoiceDiscountPercent: 0,
      items: [{ description: '', quantity: 1, rate: 0, discountPercent: 0, gstRate: '18' }],
      terms: 'Prices are valid for 30 days.\nDelivery within 7-10 working days.\nPayment: 50% advance, 50% on delivery.',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data: customersData } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => customerApi.list({ search: customerSearch, limit: 10 }),
    enabled: customerSearch.length >= 1,
  });

  const watchItems = watch('items');
  const watchIsInterState = watch('isInterState');
  const watchDiscount = watch('invoiceDiscountPercent');

  const taxItems = watchItems.map((item) => ({
    description: item.description || '',
    quantity: String(item.quantity || 0),
    rate: Math.round((item.rate || 0) * 100),
    discountPercent: String(item.discountPercent || 0),
    gstRate: item.gstRate || '18',
    cessRate: '0',
    taxType: 'exclusive' as const,
  }));
  const taxResult = taxItems.some(i => parseFloat(i.quantity) > 0)
    ? TaxService.calculate(taxItems, { isInterState: watchIsInterState, invoiceDiscountPercent: String(watchDiscount || 0) })
    : null;

  const mutation = useMutation({
    mutationFn: (data: Form) => quotationApi.create({
      ...data,
      customerId: selectedCustomer?.id ?? null,
      items: data.items.map(item => ({ ...item, rate: Math.round(item.rate * 100) })),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success(`Quotation ${res.data.quotationNumber} created!`);
      navigate('/quotations');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create quotation'),
  });

  const formatRupee = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">New Quotation</h1>
          <p className="page-subtitle">Create a price quotation for a customer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-5)', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Quotation Details</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Search */}
                <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                  <label className="form-label">Customer</label>
                  {selectedCustomer ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-primary)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{selectedCustomer.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{selectedCustomer.phone}</div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="search-input">
                        <Search size={14} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
                        <input placeholder="Search customer..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} />
                      </div>
                      {showDropdown && (customersData?.data ?? []).length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', marginTop: 4 }}>
                          {(customersData?.data ?? []).map((c: any) => (
                            <button key={c.id} type="button" className="dropdown-item" style={{ width: '100%' }} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowDropdown(false); }}>
                              <div><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{c.phone} {c.gstin && `• ${c.gstin}`}</div></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label required">Quotation Date</label>
                  <input type="date" className="form-control" {...register('quotationDate')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valid Until</label>
                  <input type="date" className="form-control" {...register('validUntil')} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Subject</label>
                  <input className="form-control" placeholder="e.g. Quotation for Office Supplies" {...register('subject')} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
                  <input type="checkbox" id="isInterState" {...register('isInterState')} style={{ width: 18, height: 18 }} />
                  <label htmlFor="isInterState" style={{ cursor: 'pointer', fontWeight: 500 }}>Inter-State (IGST)</label>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600 }}>Items</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => append({ description: '', quantity: 1, rate: 0, discountPercent: 0, gstRate: '18' })}><Plus size={14} /> Add Item</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, width: 30 }}>#</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', minWidth: 200 }}>Description</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', width: 80 }}>HSN</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', width: 80 }}>Qty</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', width: 110 }}>Rate (₹)</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', width: 80 }}>Disc %</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: 90 }}>GST %</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', width: 110 }}>Amount (₹)</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const item = watchItems[idx] || {};
                      const taxable = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discountPercent || 0) / 100);
                      const gst = taxable * parseFloat(item.gstRate || '0') / 100;
                      return (
                        <tr key={field.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '8px', textAlign: 'center', color: 'var(--color-text-dim)' }}>{idx + 1}</td>
                          <td style={{ padding: '4px 6px' }}><input className="form-control" style={{ fontSize: 'var(--text-sm)' }} placeholder="Description" {...register(`items.${idx}.description`)} /></td>
                          <td style={{ padding: '4px 6px' }}><input className="form-control" style={{ fontSize: 'var(--text-sm)' }} placeholder="HSN" {...register(`items.${idx}.hsnCode`)} /></td>
                          <td style={{ padding: '4px 6px' }}><input type="number" step="0.001" className="form-control" style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.quantity`)} /></td>
                          <td style={{ padding: '4px 6px' }}><input type="number" step="0.01" className="form-control" style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.rate`)} /></td>
                          <td style={{ padding: '4px 6px' }}><input type="number" step="0.01" className="form-control" style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.discountPercent`)} /></td>
                          <td style={{ padding: '4px 6px' }}>
                            <select className="form-control" style={{ fontSize: 'var(--text-sm)' }} {...register(`items.${idx}.gstRate`)}>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--brand-primary)' }}>
                            ₹{(taxable + gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: 4 }} onClick={() => fields.length > 1 && remove(idx)} disabled={fields.length === 1}><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="card">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={3} placeholder="Special notes for customer..." {...register('notes')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Terms & Conditions</label>
                  <textarea className="form-control" rows={3} {...register('terms')} />
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Summary</div>
              <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                <label className="form-label">Invoice Discount %</label>
                <input type="number" step="0.01" className="form-control" placeholder="0" {...register('invoiceDiscountPercent')} />
              </div>
              {taxResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  {[
                    { label: 'Subtotal', value: taxResult.subtotal },
                    taxResult.totalDiscountAmount > 0 && { label: 'Discount', value: -taxResult.totalDiscountAmount },
                    { label: 'Taxable', value: taxResult.taxableAmount },
                    !watchIsInterState && taxResult.cgstAmount > 0 && { label: 'CGST', value: taxResult.cgstAmount },
                    !watchIsInterState && taxResult.sgstAmount > 0 && { label: 'SGST', value: taxResult.sgstAmount },
                    watchIsInterState && taxResult.igstAmount > 0 && { label: 'IGST', value: taxResult.igstAmount },
                  ].filter(Boolean).map((row: any, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-1)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                      <span>{formatRupee(Math.abs(row.value))}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 'var(--text-lg)', paddingTop: 4, color: 'var(--brand-primary)' }}>
                    <span>Grand Total</span>
                    <span>{formatRupee(taxResult.grandTotal)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-dim)', fontSize: 'var(--text-sm)' }}>Add items to see totals</div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : <><Save size={14} /> Save Quotation</>}
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/quotations')}>Cancel</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
