import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette, Plus, Check, Star, Trash2, Edit3, Eye,
  Printer, Sparkles, Sliders, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { templateApi, companyApi } from '../../api';
import { PRESET_TEMPLATES } from '../../templates/presets';
import { InvoiceTemplateRecord, PresetTemplate } from '../../types/templates';
import InvoiceRenderer from '../../templates/InvoiceRenderer';
import { useAuthStore } from '../../store';

const SAMPLE_INVOICE_PREVIEW = {
  invoiceNumber: 'INV-000001',
  invoiceDate: new Date().toISOString(),
  status: 'paid',
  isInterState: false,
  subtotal: 50000,
  taxableAmount: 42373,
  cgstAmount: 3814,
  sgstAmount: 3814,
  igstAmount: 0,
  grandTotal: 50000,
  amountPaid: 50000,
  balanceDue: 0,
  amountInWords: 'Five Hundred Rupees Only',
  paymentMethod: 'cash',
  customer: { name: 'Arun Kumar', phone: '9043950352' },
  items: [
    { description: 'Quantron Gaming Keyboard RGB', quantity: '1', rate: 35000, totalAmount: 35000, gstRate: '18', hsnCode: '847160' },
    { description: 'Quantron Optical Mouse USB', quantity: '1', rate: 15000, totalAmount: 15000, gstRate: '18', hsnCode: '847160' },
  ],
};

export default function TemplatesGalleryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'A4 Standard' | 'Thermal POS' | 'Specialty' | 'Custom'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  // Fetch custom templates from backend
  const { data: customTemplatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templateApi.list,
  });
  const customTemplates: InvoiceTemplateRecord[] = customTemplatesData?.data || [];

  // Fetch company settings to see default template ID
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: companyApi.getSettings,
  });
  const defaultTemplateId = settingsData?.data?.defaultInvoiceTemplateId;

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => templateApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Default template updated!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to set default'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const allCards = [
    // Saved custom templates
    ...customTemplates.map((ct) => ({
      id: ct.id,
      name: ct.name,
      templateType: ct.templateType,
      category: 'Custom' as const,
      description: `Customized ${ct.config?.paperSize || 'A4'} template saved by your team.`,
      badge: ct.isDefault ? 'Default' : 'Custom',
      previewGradient: ct.config?.primaryColor ? `linear-gradient(135deg, ${ct.config.primaryColor} 0%, #0f172a 100%)` : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
      config: ct.config,
      isCustom: true,
      isDefault: ct.isDefault || defaultTemplateId === ct.id,
    })),
    // Built-in presets
    ...PRESET_TEMPLATES.map((pt) => ({
      ...pt,
      isCustom: false,
      isDefault: !defaultTemplateId && pt.id === 'modern_blue',
    })),
  ];

  const filteredCards = allCards.filter((card) => {
    if (filter === 'all') return true;
    if (filter === 'Custom') return card.isCustom;
    return card.category === filter;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Invoice Templates ({allCards.length})</h1>
          <p className="page-subtitle">
            Choose from 12+ ready-made GST & POS receipt templates or customize your own branding and layout.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/templates/editor" className="btn btn-primary">
            <Plus size={14} /> Create Custom Template
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', overflowX: 'auto', paddingBottom: 4 }}>
        {(['all', 'A4 Standard', 'Thermal POS', 'Specialty', 'Custom'] as const).map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm ${filter === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', textTransform: 'capitalize' }}
            onClick={() => setFilter(cat)}
          >
            {cat === 'all' ? 'All Templates' : cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {filteredCards.map((card) => (
          <div
            key={card.id}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              border: card.isDefault ? '2px solid var(--brand-primary)' : '1px solid var(--color-border)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              background: 'var(--color-surface)',
            }}
          >
            {/* Header Gradient Banner */}
            <div
              style={{
                height: 70,
                background: card.previewGradient,
                padding: 'var(--space-3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                color: 'white',
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {card.badge && (
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(4px)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {card.badge}
                  </span>
                )}
                {card.isDefault && (
                  <span
                    style={{
                      background: '#10b981',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    ★ Default
                  </span>
                )}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'white', padding: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}
                onClick={() => setPreviewTemplate(card)}
                title="Preview Template"
              >
                <Eye size={14} />
              </button>
            </div>

            {/* Card Body */}
            <div style={{ padding: 'var(--space-4)', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>{card.name}</h3>
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)', fontWeight: 600 }}>
                  {card.config?.paperSize ? card.config.paperSize.toUpperCase().replace('_', ' ') : 'A4'}
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4, flex: 1, marginBottom: 'var(--space-4)' }}>
                {card.description}
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                {card.isCustom ? (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/templates/editor/${card.id}`)}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    {!card.isDefault && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => { if (confirm(`Delete custom template "${card.name}"?`)) deleteMutation.mutate(card.id); }}
                        title="Delete template"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      // Navigate to editor prefilled with this preset
                      navigate('/templates/editor', { state: { preset: card } });
                    }}
                  >
                    <Sliders size={13} /> Customize
                  </button>
                )}

                {card.isCustom && !card.isDefault && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, color: 'var(--brand-primary)' }}
                    onClick={() => setDefaultMutation.mutate(card.id)}
                    title="Set as company default template"
                  >
                    Set Default
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            style={{
              background: '#0b1120',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 900,
              width: '100%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#0f172a',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
                  {previewTemplate.name}
                </span>
                <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 10 }}>
                  {previewTemplate.config?.paperSize?.toUpperCase() || 'A4'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPreviewTemplate(null);
                    if (previewTemplate.isCustom) {
                      navigate(`/templates/editor/${previewTemplate.id}`);
                    } else {
                      navigate('/templates/editor', { state: { preset: previewTemplate } });
                    }
                  }}
                >
                  <Sliders size={13} /> Customize in Editor
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPreviewTemplate(null)}>
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body: Rendered Preview */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', justifyContent: 'center' }}>
              <InvoiceRenderer
                invoice={SAMPLE_INVOICE_PREVIEW}
                company={currentCompany}
                config={previewTemplate.config}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
