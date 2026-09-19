import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Printer, Check, RotateCcw, Palette,
  Type, Layout, Eye, Sliders, FileText, CheckCircle2,
  Sparkles, Layers, DollarSign, Upload, Image as ImageIcon,
  Trash2, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { templateApi, invoiceApi, uploadApi, companyApi } from '../../api';
import { useAuthStore } from '../../store';
import { TemplateConfig, TemplateFont, FontSizeScale, PaperSize } from '../../types/templates';
import { PRESET_TEMPLATES, DEFAULT_TEMPLATE_CONFIG } from '../../templates/presets';
import InvoiceRenderer from '../../templates/InvoiceRenderer';

const COLOR_SWATCHES = [
  { name: 'Classic Blue', primary: '#1a56db', secondary: '#0f172a', accent: '#f0f7ff' },
  { name: 'Emerald', primary: '#059669', secondary: '#064e3b', accent: '#ecfdf5' },
  { name: 'Royal Indigo', primary: '#4f46e5', secondary: '#312e81', accent: '#eef2ff' },
  { name: 'Vibrant Purple', primary: '#7c3aed', secondary: '#4c1d95', accent: '#f5f3ff' },
  { name: 'Crimson Red', primary: '#dc2626', secondary: '#7f1d1d', accent: '#fef2f2' },
  { name: 'Charcoal Slate', primary: '#334155', secondary: '#0f172a', accent: '#f8fafc' },
  { name: 'Amber Gold', primary: '#b45309', secondary: '#78350f', accent: '#fffbeb' },
  { name: 'Pure Dark', primary: '#09090b', secondary: '#27272a', accent: '#fafafa' },
];

const SAMPLE_INVOICE = {
  id: 'sample-inv',
  invoiceNumber: 'INV-SAMPLE',
  invoiceDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
  status: 'paid',
  isInterState: false,
  placeOfSupply: '33-Tamil Nadu',
  subtotal: 50000,
  discountAmount: 0,
  taxableAmount: 42373,
  cgstAmount: 3814,
  sgstAmount: 3814,
  igstAmount: 0,
  cessAmount: 0,
  roundOff: 0,
  grandTotal: 50000,
  amountPaid: 50000,
  balanceDue: 0,
  amountInWords: 'Five Hundred Rupees Only',
  paymentMethod: 'cash',
  notes: 'Thank you for shopping with us!',
  customer: {
    name: 'Arun Kumar',
    phone: '9043950352',
    gstin: '33AAAAA0000A1Z5',
    addressLine1: '42 Cross Street, Anna Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pinCode: '600040',
  },
  items: [
    {
      description: 'Quantron Gaming Keyboard RGB',
      hsnCode: '847160',
      quantity: '1',
      rate: 35000,
      discountPercent: '0',
      taxableAmount: 29661,
      gstRate: '18',
      cgstAmount: 2669,
      sgstAmount: 2669,
      totalAmount: 35000,
    },
    {
      description: 'Quantron Optical Mouse USB',
      hsnCode: '847160',
      quantity: '1',
      rate: 15000,
      discountPercent: '0',
      taxableAmount: 12712,
      gstRate: '18',
      cgstAmount: 1144,
      sgstAmount: 1144,
      totalAmount: 15000,
    },
  ],
};

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany, updateCurrentCompany } = useAuthStore();
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'presets' | 'branding' | 'typography' | 'columns' | 'footer'>('presets');
  const [templateName, setTemplateName] = useState('My Custom Template');
  const [isDefault, setIsDefault] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [config, setConfig] = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP, or SVG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const res = await uploadApi.image(file);
      if (res?.data?.path) {
        if (currentCompany?.companyId) {
          await companyApi.update(currentCompany.companyId, { logoPath: res.data.path });
          updateCurrentCompany({ logoPath: res.data.path });
        }
        updateConfig({ showLogo: true });
        toast.success('Company logo uploaded and updated!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSignatureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP, or SVG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Signature file size must be less than 2MB');
      return;
    }

    try {
      setIsUploadingSignature(true);
      const res = await uploadApi.image(file);
      if (res?.data?.path) {
        updateConfig({ signatureImage: res.data.path });
        toast.success('Authorised signature uploaded!');
      } else {
        toast.error('Upload succeeded but no file path was returned');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload signature');
    } finally {
      setIsUploadingSignature(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveSignature = () => {
    updateConfig({ signatureImage: '' });
    toast.success('Authorised signature removed from template');
  };

  // Load existing template if editing
  const { data: templateData, isLoading: isTemplateLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => templateApi.get(id!),
    enabled: !!id,
  });

  // Load real recent invoice for preview toggle
  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-recent-preview'],
    queryFn: () => invoiceApi.list({ limit: 1 }),
  });

  useEffect(() => {
    if (templateData?.data) {
      const t = templateData.data;
      setTemplateName(t.name);
      setIsDefault(Boolean(t.isDefault));
      if (t.config) {
        setConfig({ ...DEFAULT_TEMPLATE_CONFIG, ...t.config });
      }
    }
  }, [templateData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (id) {
        return templateApi.update(id, data);
      }
      return templateApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(id ? 'Template updated successfully!' : 'Template created successfully!');
      navigate('/templates');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save template'),
  });

  const handleSave = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    saveMutation.mutate({
      name: templateName,
      templateType: config.paperSize.startsWith('thermal') ? config.paperSize : 'custom',
      isDefault,
      config,
    });
  };

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setConfig({ ...preset.config });
    if (!id) {
      setTemplateName(`${preset.name} (Custom)`);
    }
    toast.success(`Applied ${preset.name} preset!`);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;
    const isThermal = config.paperSize.startsWith('thermal');
    const width = config.paperSize === 'thermal_58' ? '58mm' : config.paperSize === 'thermal_80' ? '80mm' : 'auto';

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>${templateName} - Print Preview</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; background: #fff; }
        @media print {
          @page { size: ${isThermal ? width : 'A4 portrait'}; margin: ${isThermal ? '0' : '10mm'}; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const previewInvoice = useRealData && invoicesData?.data?.[0] ? invoicesData.data[0] : SAMPLE_INVOICE;

  const updateConfig = (patch: Partial<TemplateConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div>
      {/* Top action header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="page-header-left">
          <Link to="/templates" className="btn btn-ghost btn-sm" style={{ marginBottom: 4 }}>
            <ArrowLeft size={14} /> Back to Templates
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1 className="page-title" style={{ fontSize: 'var(--text-xl)' }}>
              {id ? 'Edit Invoice Template' : 'Invoice Template Editor'}
            </h1>
            <span className="badge badge-primary" style={{ fontSize: 11 }}>Live Customizer</span>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={14} /> Test Print
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save size={14} /> {saveMutation.isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Main 2-column Editor Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        {/* Left Column: Control Panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'calc(100vh - 170px)', display: 'flex', flexDirection: 'column' }}>
          {/* Template Name & Default toggle bar */}
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
            <div style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 2 }}>Template Name</label>
              <input
                className="form-control"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Modern Retail Slip"
                style={{ fontSize: 'var(--text-sm)' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                style={{ accentColor: 'var(--brand-primary)' }}
              />
              <span style={{ fontWeight: 600 }}>Set as default company template</span>
            </label>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            {[
              { id: 'presets', label: 'Presets', icon: Sparkles },
              { id: 'branding', label: 'Colors', icon: Palette },
              { id: 'typography', label: 'Layout', icon: Layout },
              { id: 'columns', label: 'Columns', icon: Sliders },
              { id: 'footer', label: 'Terms', icon: FileText },
            ].map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId as any)}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  border: 'none',
                  borderBottom: activeTab === tabId ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === tabId ? 'var(--brand-primary)' : 'var(--color-text-muted)',
                  fontSize: 11,
                  fontWeight: activeTab === tabId ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content Panel (Scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
            {/* 1. Presets */}
            {activeTab === 'presets' && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                  Start with a professionally crafted base template:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                  {PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: config.paperSize === preset.config.paperSize && config.primaryColor === preset.config.primaryColor
                          ? '2px solid var(--brand-primary)'
                          : '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                      onMouseLeave={(e) => {
                        if (!(config.paperSize === preset.config.paperSize && config.primaryColor === preset.config.primaryColor)) {
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                        }
                      }}
                    >
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: preset.previewGradient, marginBottom: 6 }} />
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text)' }}>{preset.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2 }}>{preset.badge || preset.category}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Branding & Colors */}
            {activeTab === 'branding' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Preset palettes */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Quick Color Palette</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.name}
                        onClick={() => updateConfig({ primaryColor: swatch.primary, secondaryColor: swatch.secondary, accentColor: swatch.accent })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 6px',
                          borderRadius: 'var(--radius-md)',
                          border: config.primaryColor === swatch.primary ? '2px solid var(--color-text)' : '1px solid var(--color-border)',
                          background: 'var(--color-surface-2)',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: swatch.primary }} />
                        <span style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{swatch.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Primary Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        value={config.primaryColor}
                        onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                        style={{ width: 34, height: 34, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        className="form-control"
                        value={config.primaryColor}
                        onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                        style={{ fontSize: 'var(--text-xs)', height: 32 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Secondary / Header</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        value={config.secondaryColor || '#0f172a'}
                        onChange={(e) => updateConfig({ secondaryColor: e.target.value })}
                        style={{ width: 34, height: 34, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        className="form-control"
                        value={config.secondaryColor || '#0f172a'}
                        onChange={(e) => updateConfig({ secondaryColor: e.target.value })}
                        style={{ fontSize: 'var(--text-xs)', height: 32 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Company Logo Controls */}
                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  background: 'var(--color-surface)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={config.showLogo}
                        onChange={(e) => updateConfig({ showLogo: e.target.checked })}
                        style={{ accentColor: 'var(--brand-primary)' }}
                      />
                      <span style={{ fontWeight: 600 }}>Show Company Logo</span>
                    </label>
                    {currentCompany?.logoPath && (
                      <span className="badge badge-success" style={{ fontSize: 9 }}>Logo Configured</span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={logoInputRef}
                    style={{ display: 'none' }}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                  />

                  {config.showLogo && (
                    <div style={{ marginTop: 8 }}>
                      {currentCompany?.logoPath ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '6px 10px',
                        }}>
                          <img
                            src={currentCompany.logoPath.startsWith('http') ? currentCompany.logoPath : (currentCompany.logoPath.startsWith('/') ? currentCompany.logoPath : `/${currentCompany.logoPath}`)}
                            alt="Logo"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.retried && currentCompany?.logoPath) {
                                target.dataset.retried = 'true';
                                target.src = `http://localhost:4000${currentCompany.logoPath.startsWith('/') ? '' : '/'}${currentCompany.logoPath}`;
                              }
                            }}
                            style={{ maxHeight: 36, maxWidth: 90, objectFit: 'contain' }}
                          />
                          <div style={{ flex: 1, fontSize: 10, color: '#64748b' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>Active Logo</div>
                            <div>Appears on header</div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            style={{ fontSize: 11, padding: '4px 8px', height: 'auto' }}
                          >
                            <Upload size={12} /> Replace
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => logoInputRef.current?.click()}
                          style={{
                            border: '1px dashed #cbd5e1',
                            borderRadius: 6,
                            padding: '12px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: '#f8fafc',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                            {isUploadingLogo ? <Loader2 size={16} className="animate-spin text-primary" /> : <Upload size={16} style={{ color: 'var(--brand-primary)' }} />}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{isUploadingLogo ? 'Uploading logo...' : 'Upload Company Logo'}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Header Style */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Header Style</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {[
                      { id: 'bar', label: 'Primary Bar' },
                      { id: 'clean', label: 'Minimalist' },
                      { id: 'boxed', label: 'Full Border' },
                      { id: 'gradient', label: 'Gradient' },
                      { id: 'centered', label: 'Centered (POS)' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        className={`btn btn-sm ${config.headerStyle === style.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11, padding: '4px 6px' }}
                        onClick={() => updateConfig({ headerStyle: style.id as any })}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Invoice Title */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Invoice Heading Title</label>
                  <input
                    className="form-control"
                    value={config.invoiceTitle}
                    onChange={(e) => updateConfig({ invoiceTitle: e.target.value })}
                    placeholder="e.g. TAX INVOICE, CASH MEMO"
                    style={{ fontSize: 'var(--text-xs)' }}
                  />
                </div>

                {/* Watermark text */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Background Watermark (optional)</label>
                  <input
                    className="form-control"
                    value={config.watermarkText || ''}
                    onChange={(e) => updateConfig({ watermarkText: e.target.value })}
                    placeholder="e.g. PAID, ORIGINAL, DUPLICATE"
                    style={{ fontSize: 'var(--text-xs)' }}
                  />
                </div>
              </div>
            )}

            {/* 3. Typography & Paper Size */}
            {activeTab === 'typography' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Paper Size */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Paper & Print Format</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { id: 'a4', label: '📄 A4 Standard' },
                      { id: 'a5', label: '📑 A5 Half Page' },
                      { id: 'thermal_80', label: '🧾 Thermal 80mm (3")' },
                      { id: 'thermal_58', label: '📱 Thermal 58mm (2")' },
                    ].map((size) => (
                      <button
                        key={size.id}
                        className={`btn btn-sm ${config.paperSize === size.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px' }}
                        onClick={() => updateConfig({ paperSize: size.id as PaperSize })}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Font Family</label>
                  <select
                    className="form-control"
                    value={config.fontFamily}
                    onChange={(e) => updateConfig({ fontFamily: e.target.value as TemplateFont })}
                    style={{ fontSize: 'var(--text-xs)' }}
                  >
                    <option value="inter">Inter (Modern & Clean)</option>
                    <option value="roboto">Roboto (Standard Business)</option>
                    <option value="poppins">Poppins (Geometric & Friendly)</option>
                    <option value="outfit">Outfit (Contemporary Corporate)</option>
                    <option value="serif">Playfair / Serif (Luxury & Elegant)</option>
                    <option value="mono">Courier / Monospace (Thermal POS Slip)</option>
                    <option value="system">System Default</option>
                  </select>
                </div>

                {/* Font Size Scale */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Font Scale / Density</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { id: 'small', label: 'Compact / High Density' },
                      { id: 'medium', label: 'Standard' },
                      { id: 'large', label: 'Spacious' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        className={`btn btn-sm ${config.fontSize === s.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: 11 }}
                        onClick={() => updateConfig({ fontSize: s.id as FontSizeScale })}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Header Information Toggles */}
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Company Details Display</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { key: 'showCompanyAddress', label: 'Show Company Address' },
                      { key: 'showCompanyGstin', label: 'Show Company GSTIN' },
                      { key: 'showCompanyPhone', label: 'Show Phone Number' },
                      { key: 'showCompanyEmail', label: 'Show Email Address' },
                      { key: 'showPaymentStatusBadge', label: 'Show Payment Status Badge' },
                    ].map(({ key, label }) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean((config as any)[key])}
                          onChange={(e) => updateConfig({ [key]: e.target.checked })}
                          style={{ accentColor: 'var(--brand-primary)' }}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Table Columns & Visibility */}
            {activeTab === 'columns' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  Customize which item table columns appear on print and invoices:
                </div>
                {[
                  { key: 'showHsnCode', label: 'HSN / SAC Code Column', desc: 'Required for GST compliance on B2B' },
                  { key: 'showDiscount', label: 'Item Discount % Column', desc: 'Displays line-level discount percentage' },
                  { key: 'showGstBreakdown', label: 'Separate Tax Columns (CGST + SGST / IGST)', desc: 'Uncheck to show simplified GST% column' },
                  { key: 'showAmountInWords', label: 'Amount in Words', desc: 'Displays Indian currency wording below table' },
                  { key: 'showRoundOff', label: 'Round Off Row', desc: 'Displays rounding adjustment to nearest rupee' },
                  { key: 'showBankDetails', label: 'Bank & Remittance Box', desc: 'Displays company bank name, A/C, IFSC on bill' },
                ].map(({ key, label, desc }) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean((config as any)[key])}
                      onChange={(e) => updateConfig({ [key]: e.target.checked })}
                      style={{ accentColor: 'var(--brand-primary)', marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{label}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 5. Footer, Terms & Signatory */}
            {activeTab === 'footer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Terms & Conditions</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={config.customTerms || ''}
                    onChange={(e) => updateConfig({ customTerms: e.target.value })}
                    placeholder="1. Goods once sold will not be returned..."
                    style={{ fontSize: 'var(--text-xs)' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Custom Invoice Notes</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={config.customNotes || ''}
                    onChange={(e) => updateConfig({ customNotes: e.target.value })}
                    placeholder="Thank you for your business!"
                    style={{ fontSize: 'var(--text-xs)' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Footer Watermark / Legal Notice</label>
                  <input
                    className="form-control"
                    value={config.footerNote || ''}
                    onChange={(e) => updateConfig({ footerNote: e.target.value })}
                    style={{ fontSize: 'var(--text-xs)' }}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', cursor: 'pointer', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={config.showAuthorizedSignatory}
                      onChange={(e) => updateConfig({ showAuthorizedSignatory: e.target.checked })}
                      style={{ accentColor: 'var(--brand-primary)' }}
                    />
                    <span style={{ fontWeight: 600 }}>Show Authorised Signatory</span>
                  </label>

                  {config.showAuthorizedSignatory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 10 }}>Signatory Title</label>
                          <input
                            className="form-control"
                            value={config.signatoryTitle || ''}
                            onChange={(e) => updateConfig({ signatoryTitle: e.target.value })}
                            style={{ fontSize: 11 }}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 10 }}>Signatory Label</label>
                          <input
                            className="form-control"
                            value={config.signatoryLabel || ''}
                            onChange={(e) => updateConfig({ signatoryLabel: e.target.value })}
                            placeholder="For {{companyName}}"
                            style={{ fontSize: 11 }}
                          />
                        </div>
                      </div>

                      {/* Authorised Signature Upload & Preview */}
                      <div style={{
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px',
                        background: 'var(--color-surface)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ImageIcon size={13} style={{ color: 'var(--brand-primary)' }} />
                            Authorised Signature Image
                          </span>
                          {config.signatureImage && (
                            <span className="badge badge-primary" style={{ fontSize: 9 }}>Template Custom</span>
                          )}
                          {!config.signatureImage && currentCompany?.signaturePath && (
                            <span className="badge badge-default" style={{ fontSize: 9 }}>Company Default</span>
                          )}
                        </div>

                        {/* Hidden file input */}
                        <input
                          type="file"
                          ref={signatureInputRef}
                          style={{ display: 'none' }}
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleSignatureFileChange}
                        />

                        {/* Signature preview if either template config or company has one */}
                        {(() => {
                          const sig = config.signatureImage || currentCompany?.signaturePath;
                          if (sig) {
                            const sigUrl = sig.startsWith('http://') || sig.startsWith('https://') || sig.startsWith('data:')
                              ? sig
                              : (sig.startsWith('/') ? sig : `/${sig}`);
                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6,
                                padding: '8px 12px',
                                marginBottom: 6,
                              }}>
                                <div style={{
                                  background: '#f8fafc',
                                  border: '1px solid #f1f5f9',
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: 100,
                                  minHeight: 44,
                                }}>
                                  <img
                                    src={sigUrl}
                                    alt="Signature Preview"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (!target.dataset.retried && sig) {
                                        target.dataset.retried = 'true';
                                        target.src = `http://localhost:4000${sig.startsWith('/') ? '' : '/'}${sig}`;
                                      }
                                    }}
                                    style={{ maxHeight: 40, maxWidth: 110, objectFit: 'contain' }}
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#64748b' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>Signature Ready</div>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {config.signatureImage ? 'Custom signature active' : 'Using company default'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => signatureInputRef.current?.click()}
                                    disabled={isUploadingSignature}
                                    style={{ fontSize: 11, padding: '4px 8px', height: 'auto' }}
                                    title="Replace signature"
                                  >
                                    <Upload size={12} /> Replace
                                  </button>
                                  {config.signatureImage && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm text-danger"
                                      onClick={handleRemoveSignature}
                                      style={{ fontSize: 11, padding: '4px 8px', height: 'auto', color: '#ef4444' }}
                                      title="Remove custom signature"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              onClick={() => signatureInputRef.current?.click()}
                              style={{
                                border: '1px dashed #cbd5e1',
                                borderRadius: 6,
                                padding: '14px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: '#f8fafc',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
                            >
                              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                                {isUploadingSignature ? (
                                  <Loader2 size={18} className="animate-spin text-primary" />
                                ) : (
                                  <Upload size={18} style={{ color: 'var(--brand-primary)' }} />
                                )}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>
                                {isUploadingSignature ? 'Uploading signature...' : 'Upload Signature'}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2 }}>
                                PNG, JPG, WEBP (transparent PNG recommended, max 2MB)
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Real-Time Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Preview Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 16px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              <Eye size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>Live Preview</span>
              <span className="badge badge-default" style={{ fontSize: 10 }}>
                {config.paperSize.toUpperCase().replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useRealData}
                  onChange={(e) => setUseRealData(e.target.checked)}
                  style={{ accentColor: 'var(--brand-primary)' }}
                />
                <span>Use latest real invoice data</span>
              </label>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfig(DEFAULT_TEMPLATE_CONFIG)}
                title="Reset to defaults"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          {/* Render Container */}
          <div
            style={{
              background: '#0b1120',
              padding: '32px 16px',
              borderRadius: 'var(--radius-xl)',
              overflowX: 'auto',
              minHeight: 650,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <InvoiceRenderer
              invoice={previewInvoice}
              company={currentCompany}
              config={config}
              printRef={printRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
