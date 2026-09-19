import { useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, X, IndianRupee, Palette, Sliders, Check } from 'lucide-react';
import { invoiceApi, templateApi, companyApi } from '../../api';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';
import PaymentModal from '../../components/PaymentModal';
import InvoiceRenderer from '../../templates/InvoiceRenderer';
import { PRESET_TEMPLATES, DEFAULT_TEMPLATE_CONFIG } from '../../templates/presets';
import { TemplateConfig, InvoiceTemplateRecord } from '../../types/templates';

const STATUS_BADGES: Record<string, string> = {
  draft: 'badge-default', pending: 'badge-warning', paid: 'badge-success',
  partial: 'badge-info', overdue: 'badge-danger', cancelled: 'badge-danger',
  confirmed: 'badge-success',
};

function formatLongDate(dateStr?: string | Date | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { dateStyle: 'long' });
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Template selection state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('modern_blue');

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceApi.get(id!),
    enabled: !!id,
  });

  // Fetch company custom templates
  const { data: customTemplatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: templateApi.list,
  });
  const customTemplates: InvoiceTemplateRecord[] = customTemplatesData?.data || [];

  // Fetch company settings for default template
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: companyApi.getSettings,
  });
  const defaultTemplateId = settingsData?.data?.defaultInvoiceTemplateId;

  // Compute active template configuration
  const activeConfig: TemplateConfig = useMemo(() => {
    // 1. Check custom templates
    const customMatch = customTemplates.find((t) => t.id === selectedTemplateKey);
    if (customMatch?.config) return customMatch.config;

    // 2. Check preset templates
    const presetMatch = PRESET_TEMPLATES.find((p) => p.id === selectedTemplateKey);
    if (presetMatch?.config) return presetMatch.config;

    // 3. Fallback to default
    return DEFAULT_TEMPLATE_CONFIG;
  }, [selectedTemplateKey, customTemplates]);

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => invoiceApi.cancel(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      toast.success('Invoice cancelled');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;
    const isThermal = activeConfig.paperSize?.startsWith('thermal');
    const thermalWidth = activeConfig.paperSize === 'thermal_58' ? '58mm' : '80mm';

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>Invoice - ${data?.data?.invoice?.invoiceNumber || data?.data?.invoiceNumber || 'Print'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #fff; color: #000; }
        @media print {
          @page {
            size: ${isThermal ? thermalWidth : 'A4 portrait'};
            margin: ${isThermal ? '0' : '8mm'};
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      </head><body><div class="print-container">${printRef.current.innerHTML}</div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const { currentCompany } = useAuthStore();
  const raw = data?.data;
  const inv = raw?.invoice || raw;
  const rawCompany = raw?.company || inv?.company;
  const company = {
    ...currentCompany,
    ...rawCompany,
    name: rawCompany?.name || currentCompany?.companyName || 'Company',
    logoPath: rawCompany?.logoPath || currentCompany?.logoPath,
    signaturePath: rawCompany?.signaturePath || currentCompany?.signaturePath,
  };

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}><div className="spinner spinner-lg" /></div>;
  if (!inv || !inv.id) return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Invoice not found</div>;

  const canCancel = inv.status !== 'cancelled';
  const balanceDue = inv.balanceDue ?? inv.balanceAmount ?? 0;
  const billToName = inv.customer?.name || inv.customerName || 'Walk-in Customer';

  return (
    <div>
      {/* Top Header */}
      <div className="page-header no-print">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-2)' }} onClick={() => navigate('/invoices')}>
            <ArrowLeft size={14} /> Back to Invoices
          </button>
          <h1 className="page-title">Invoice {inv.invoiceNumber}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 4 }}>
            <span className={`badge ${STATUS_BADGES[inv.status] || 'badge-default'}`}>{inv.status}</span>
            <span className="text-muted text-sm">{formatLongDate(inv.invoiceDate)}</span>
          </div>
        </div>
        <div className="page-actions no-print">
          <button className="btn btn-secondary" onClick={handlePrint}><Printer size={14} /> Print</button>
          {balanceDue > 0 && (
            <button className="btn btn-success" onClick={() => setShowPayment(true)}>
              <IndianRupee size={14} /> Record Payment
            </button>
          )}
          {canCancel && (
            <button className="btn btn-danger" onClick={() => { const reason = prompt('Reason for cancellation:'); if (reason) cancelMutation.mutate(reason); }}>
              <X size={14} /> Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {/* Template Selector Bar */}
      <div
        className="card no-print"
        style={{
          padding: '10px 16px',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Palette size={16} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Invoice Template:</span>
          <select
            className="form-control"
            value={selectedTemplateKey}
            onChange={(e) => setSelectedTemplateKey(e.target.value)}
            style={{ width: 'auto', minWidth: 200, fontSize: 'var(--text-xs)', height: 32 }}
          >
            <optgroup label="Preset Templates">
              {PRESET_TEMPLATES.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.category})
                </option>
              ))}
            </optgroup>
            {customTemplates.length > 0 && (
              <optgroup label="Custom Company Templates">
                {customTemplates.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    ★ {ct.name} (Custom)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/templates/editor" className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
            <Sliders size={13} /> Customize / Template Editor
          </Link>
          <Link to="/templates" className="btn btn-ghost btn-sm">
            All Templates Gallery
          </Link>
        </div>
      </div>

      {/* Rendered Invoice Card */}
      <div style={{ background: '#0b1120', padding: '24px 16px', borderRadius: 'var(--radius-xl)', display: 'flex', justifyContent: 'center' }}>
        <InvoiceRenderer
          invoice={inv}
          company={company}
          config={activeConfig}
          printRef={printRef}
        />
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          invoiceId={id}
          partyName={billToName}
          balanceDue={balanceDue}
          paymentType="receipt"
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
          }}
        />
      )}
    </div>
  );
}
