import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, Zap, User, ShoppingBag, X, Loader2, Barcode, UserPlus } from 'lucide-react';
import { productApi, customerApi, invoiceApi, warehouseApi } from '../../api';
import { useCartStore } from '../../store';
import { TaxService } from '../../utils/taxUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CustomerModal from '../customers/CustomerModal';

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'credit'];

export default function POSPage() {
  const navigate = useNavigate();
  const cart = useCartStore();
  const [productSearch, setProductSearch] = useState('');
  const [customerMode, setCustomerMode] = useState<'walkin' | 'registered'>('walkin');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinName, setWalkinName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['pos-products', productSearch],
    queryFn: () => productApi.list({ search: productSearch.trim() || undefined, limit: 48 }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: () => customerApi.list({ search: customerSearch, limit: 10 }),
    enabled: customerSearch.length >= 2,
  });

  const { data: warehousesData } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.list });
  const defaultWarehouse = warehousesData?.data?.find((w: any) => w.isDefault);

  const products = productsData?.data ?? [];
  const customers = customersData?.data ?? [];

  // Calculate totals using TaxService
  const cartItems = cart.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    rate: item.rate * 100, // convert rupees to paise for calculation
    discountPercent: item.discountPercent,
    gstRate: item.gstRate,
    cessRate: item.cessRate || '0',
    taxType: item.taxType || 'exclusive',
  }));

  const taxResult = cartItems.length > 0
    ? TaxService.calculate(cartItems, { isInterState: cart.isInterState, invoiceDiscountPercent: cart.invoiceDiscountPercent })
    : null;

  const addToCart = (product: any) => {
    const existingIdx = cart.items.findIndex((i) => i.productId === product.id);
    if (existingIdx >= 0) {
      const existing = cart.items[existingIdx];
      const newQty = (parseFloat(existing.quantity) + 1).toString();
      cart.updateItem(existing.id, { quantity: newQty });
    } else {
      cart.addItem({
        productId: product.id,
        warehouseId: defaultWarehouse?.id,
        description: product.name,
        hsnCode: product.hsnCode,
        quantity: '1',
        unit: product.unit?.abbreviation,
        rate: Number(product.sellingPrice) || 0, // store in rupees
        discountPercent: '0',
        gstRate: product.gstRate || '18',
        cessRate: '0',
        taxType: (product.taxType as any) || 'exclusive',
      });
    }
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    try {
      const result = await productApi.searchByBarcode(barcodeInput.trim());
      if (result.data) {
        addToCart(result.data);
        setBarcodeInput('');
        toast.success(`Added: ${result.data.name}`);
      } else {
        toast.error('Product not found for barcode');
      }
    } catch {
      toast.error('Barcode not found');
    }
  };

  const createInvoiceMutation = useMutation({
    mutationFn: () => {
      if (!taxResult || cart.items.length === 0) throw new Error('Cart is empty');
      const grandTotalRupees = (taxResult.grandTotal ?? 0) / 100;
      const isWalkin = customerMode === 'walkin' || !selectedCustomer;
      const customerId = !isWalkin ? selectedCustomer?.id : undefined;
      const customerName = isWalkin ? (walkinName.trim() || undefined) : selectedCustomer?.name;
      const customerPhone = isWalkin ? (walkinPhone.trim() || undefined) : selectedCustomer?.phone;
      const walkinDetails = isWalkin && (walkinPhone || walkinName)
        ? `Walk-in: ${[walkinName, walkinPhone].filter(Boolean).join(' • ')}`
        : undefined;
      const finalNotes = [cart.notes, walkinDetails].filter(Boolean).join('\n') || undefined;

      const payload = {
        customerId,
        customerName,
        customerPhone,
        invoiceDate: new Date().toISOString(),
        isInterState: cart.isInterState,
        paymentMethod: cart.paymentMethod || 'cash',
        payments: [
          {
            method: cart.paymentMethod || 'cash',
            amount: grandTotalRupees,
          },
        ],
        notes: finalNotes,
        items: cart.items.map((item) => ({
          productId: item.productId || undefined,
          warehouseId: item.warehouseId || undefined,
          description: item.description,
          hsnCode: item.hsnCode || undefined,
          quantity: item.quantity,
          rate: Number(item.rate), // in rupees (backend converts to paise via TaxService.rupeesToPaise)
          discountPercent: item.discountPercent || '0',
          gstRate: item.gstRate || '18',
          cessRate: item.cessRate || '0',
          taxType: item.taxType || 'exclusive',
        })),
        invoiceDiscountPercent: cart.invoiceDiscountPercent || '0',
      };
      return invoiceApi.create(payload);
    },
    onSuccess: (result) => {
      toast.success(`Invoice ${result.data.invoiceNumber} created!`);
      cart.clearCart();
      setSelectedCustomer(null);
      setWalkinPhone('');
      setWalkinName('');
      navigate(`/invoices/${result.data.id}`);
    },
    onError: (err: any) => {
      const errorDetails = err.response?.data?.errors?.length
        ? err.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')
        : (err.response?.data?.message || 'Failed to create invoice');
      toast.error(errorDetails);
    },
  });

  const formatRupee = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: 'calc(100vh - var(--topbar-height))', gap: 'var(--space-4)', overflow: 'hidden' }}>
      {/* Left — Product Search + Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', overflow: 'hidden' }}>
        {/* Search bar */}
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <div className="search-input" style={{ flex: 1 }}>
              <Search size={16} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
              <input
                placeholder="Search products by name, SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                className="form-control"
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                style={{ width: 180 }}
              />
              <button className="btn btn-secondary" onClick={handleBarcodeSearch}>
                <Barcode size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {productsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--color-text-dim)' }}>
              <Loader2 className="spinner" size={24} /> Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
              <div className="empty-state-icon"><ShoppingBag size={36} /></div>
              <div className="empty-state-title">{productSearch.trim() ? 'No matching products' : 'No products in catalog'}</div>
              <div className="empty-state-message">
                {productSearch.trim() ? `No products match "${productSearch}"` : 'Add products from the Products page to start billing.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
              {products.map((p: any) => (
                <button
                  key={p.id}
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer', padding: 'var(--space-3)', transition: 'all 0.15s', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                  onClick={() => addToCart(p)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-primary)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: 36, height: 36, background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-2)', color: 'var(--brand-primary)' }}>
                    <ShoppingBag size={18} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', marginBottom: 4 }}>GST: {p.gstRate}%</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: 'var(--text-base)' }}>
                      ₹{Number(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: p.totalStock <= 0 ? 'var(--color-danger)' : p.totalStock <= p.minStock ? 'var(--color-warning)' : 'var(--color-text-dim)' }}>
                      {p.totalStock <= 0 ? 'Out of stock' : `Stock: ${p.totalStock}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — Cart */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {/* Cart header */}
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>🛒 Cart ({cart.items.length})</span>
          {cart.items.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => { if (confirm('Clear cart?')) cart.clearCart(); }}>
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--color-surface-2)', padding: 3, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-2)' }}>
            <button
              type="button"
              className={`btn btn-sm ${customerMode === 'walkin' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, padding: '4px 8px', fontSize: 'var(--text-xs)', justifyContent: 'center', borderRadius: 'var(--radius-md)' }}
              onClick={() => { setCustomerMode('walkin'); setSelectedCustomer(null); }}
            >
              🚶 Walk-in Customer
            </button>
            <button
              type="button"
              className={`btn btn-sm ${customerMode === 'registered' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, padding: '4px 8px', fontSize: 'var(--text-xs)', justifyContent: 'center', borderRadius: 'var(--radius-md)' }}
              onClick={() => setCustomerMode('registered')}
            >
              👥 Registered / Search
            </button>
          </div>

          {customerMode === 'walkin' ? (
            <div style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2) var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
                  🚶 Counter Sale (Walk-in)
                </span>
                <span className="badge badge-success" style={{ fontSize: 10 }}>Quick POS</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  className="form-control"
                  style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', height: 28 }}
                  placeholder="Mobile No. (optional)"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                />
                <input
                  className="form-control"
                  style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', height: 28 }}
                  placeholder="Name (optional)"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                />
              </div>
            </div>
          ) : selectedCustomer ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2) var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--brand-primary)' }}>{selectedCustomer.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {selectedCustomer.phone || 'No phone'} {selectedCustomer.gstin && `• GSTIN: ${selectedCustomer.gstin}`}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" title="Clear customer (switch to Walk-in)" onClick={() => { setSelectedCustomer(null); setCustomerMode('walkin'); }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <div className="search-input" style={{ flex: 1 }}>
                  <User size={14} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
                  <input
                    placeholder="Search by name, phone, or GSTIN..."
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSearch(true); }}
                    onFocus={() => setShowCustomerSearch(true)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 4, whiteSpace: 'nowrap' }}
                  onClick={() => setShowCustomerModal(true)}
                  title="Add new customer manually"
                >
                  <UserPlus size={14} /> + New
                </button>
              </div>

              {showCustomerSearch && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', zIndex: 100, boxShadow: 'var(--shadow-lg)', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: '100%', border: 'none', background: 'none', color: 'var(--brand-primary)', fontWeight: 600 }}
                    onClick={() => { setCustomerMode('walkin'); setSelectedCustomer(null); setShowCustomerSearch(false); }}
                  >
                    🚶 Use Walk-in Customer (Counter Sale)
                  </button>
                  {customers.map((c: any) => (
                    <button key={c.id} className="dropdown-item" style={{ width: '100%', border: 'none', background: 'none' }}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerSearch(false); }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>
                          {c.phone || 'No phone'} {c.gstin && `• ${c.gstin}`}
                        </div>
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: '100%', border: 'none', background: 'none', color: 'var(--brand-primary)', fontWeight: 600, borderTop: '1px solid var(--color-border)' }}
                    onClick={() => { setShowCustomerModal(true); setShowCustomerSearch(false); }}
                  >
                    <UserPlus size={14} /> + Add New Customer Manually
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {cart.items.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', gap: 8 }}>
              <ShoppingBag size={40} />
              <div style={{ fontSize: 'var(--text-sm)' }}>Cart is empty</div>
              <div style={{ fontSize: 'var(--text-xs)' }}>Search and add products</div>
            </div>
          ) : cart.items.map((item) => (
            <div key={item.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2) var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, flex: 1, paddingRight: 8 }}>{item.description}</div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: 2 }} onClick={() => cart.removeItem(item.id)}><X size={12} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px 6px' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }} onClick={() => {
                    const q = Math.max(0, parseFloat(item.quantity) - 1);
                    if (q === 0) cart.removeItem(item.id); else cart.updateItem(item.id, { quantity: q.toString() });
                  }}><Minus size={12} /></button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => cart.updateItem(item.id, { quantity: e.target.value })}
                    style={{ width: 40, textAlign: 'center', background: 'none', border: 'none', outline: 'none', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}
                    min="0"
                  />
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }} onClick={() => {
                    cart.updateItem(item.id, { quantity: (parseFloat(item.quantity) + 1).toString() });
                  }}><Plus size={12} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>₹</span>
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => cart.updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                    style={{ width: 70, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontSize: 'var(--text-sm)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <input
                    type="number"
                    value={item.discountPercent}
                    onChange={(e) => cart.updateItem(item.id, { discountPercent: e.target.value })}
                    style={{ width: 40, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontSize: 'var(--text-xs)', color: 'var(--color-text)', outline: 'none' }}
                    placeholder="0"
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>%</span>
                </div>
                <div style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  ₹{((parseFloat(item.quantity) || 0) * item.rate * (1 - parseFloat(item.discountPercent || '0') / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', marginTop: 4 }}>GST {item.gstRate}%</div>
            </div>
          ))}
        </div>

        {/* Cart Totals */}
        {cart.items.length > 0 && taxResult && (
          <div style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {[
                { label: 'Subtotal', value: taxResult.subtotal, style: {} },
                taxResult.totalDiscountAmount > 0 && { label: 'Discount', value: -taxResult.totalDiscountAmount, style: { color: 'var(--color-success)' } },
                { label: 'Taxable Amount', value: taxResult.taxableAmount, style: {} },
                !cart.isInterState && { label: 'CGST', value: taxResult.cgstAmount, style: { color: 'var(--color-text-dim)' } },
                !cart.isInterState && { label: 'SGST', value: taxResult.sgstAmount, style: { color: 'var(--color-text-dim)' } },
                cart.isInterState && { label: 'IGST', value: taxResult.igstAmount, style: { color: 'var(--color-text-dim)' } },
                taxResult.roundOff !== 0 && { label: 'Round Off', value: taxResult.roundOff, style: {} },
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', ...row.style }}>
                  <span>{row.label}</span>
                  <span>{formatRupee(row.value)}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--brand-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontWeight: 600 }}>Total</span>
                <span style={{ color: 'white', fontWeight: 800, fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>
                  {formatRupee(taxResult.grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <select className="form-control" value={cart.paymentMethod} onChange={(e) => cart.setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
              </select>
            </div>

            {/* Invoice discount */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Invoice Disc %:</span>
              <input
                type="number" min="0" max="100"
                className="form-control"
                value={cart.invoiceDiscountPercent}
                onChange={(e) => cart.setInvoiceDiscount(e.target.value)}
                style={{ width: 70 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={cart.isInterState} onChange={(e) => cart.setInterState(e.target.checked)} />
                Inter-State
              </label>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={createInvoiceMutation.isPending}
              onClick={() => createInvoiceMutation.mutate()}
            >
              {createInvoiceMutation.isPending
                ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating...</>
                : <><Zap size={16} /> Create Invoice</>
              }
            </button>
          </div>
        )}
      </div>

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSuccess={(newCustomer) => {
            if (newCustomer) {
              setSelectedCustomer(newCustomer);
              setCustomerMode('registered');
            }
            setShowCustomerModal(false);
          }}
        />
      )}
    </div>
  );
}
