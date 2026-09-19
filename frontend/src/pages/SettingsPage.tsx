import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2, Bell, Shield, CreditCard, Upload, Image as ImageIcon,
  Trash2, Loader2, CheckCircle2, FileText, ArrowRight, ExternalLink, Server
} from 'lucide-react';
import toast from 'react-hot-toast';
import { companyApi, uploadApi, authApi } from '../api';
import { useAuthStore } from '../store';
import ServerConfigModal from '../components/common/ServerConfigModal';

export default function SettingsPage() {
  const [tab, setTab] = useState<'company' | 'billing' | 'notifications' | 'security'>('company');
  const [showServerModal, setShowServerModal] = useState(false);
  const { currentCompany, updateCurrentCompany } = useAuthStore();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.companyId;

  // Refs for hidden file inputs
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Fetch full company details
  const { data: companyRes, refetch: refetchCompany } = useQuery({
    queryKey: ['company-detail', companyId],
    queryFn: () => companyApi.get(companyId!),
    enabled: !!companyId,
  });
  const company = companyRes?.data || currentCompany;

  // Fetch billing settings
  const { data: settingsRes, refetch: refetchSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: companyApi.getSettings,
  });
  const settings = settingsRes?.data;

  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    businessType: 'Retail',
    gstRegistrationType: 'regular',
    phone: '',
    email: '',
    addressLine1: '',
    city: '',
    state: '',
    pinCode: '',
  });

  const [billingForm, setBillingForm] = useState({
    invoicePrefix: 'INV',
    quotationPrefix: 'QT',
    upiId: '',
    defaultPaymentTerms: 30,
    invoiceFooter: 'Thank you for your business!',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Sync loaded data to form state
  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || company.companyName || '',
        legalName: company.legalName || '',
        gstin: company.gstin || '',
        pan: company.pan || '',
        businessType: company.businessType || 'Retail',
        gstRegistrationType: company.gstRegistrationType || 'regular',
        phone: company.phone || '',
        email: company.email || '',
        addressLine1: company.addressLine1 || '',
        city: company.city || '',
        state: company.state || '',
        pinCode: company.pinCode || '',
      });
    }
  }, [company]);

  useEffect(() => {
    if (settings) {
      setBillingForm({
        invoicePrefix: settings.invoicePrefix || 'INV',
        quotationPrefix: settings.quotationPrefix || 'QT',
        upiId: settings.upiId || '',
        defaultPaymentTerms: settings.defaultPaymentTerms || 30,
        invoiceFooter: settings.invoiceFooter || 'Thank you for your business!',
      });
    }
  }, [settings]);

  // Company details mutation
  const updateCompanyMutation = useMutation({
    mutationFn: (data: any) => companyApi.update(companyId!, data),
    onSuccess: () => {
      refetchCompany();
      updateCurrentCompany({
        companyName: companyForm.name,
        gstin: companyForm.gstin,
      });
      toast.success('Company details updated successfully!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update company details'),
  });

  // Billing settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => companyApi.updateSettings(data),
    onSuccess: () => {
      refetchSettings();
      toast.success('Billing settings updated successfully!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update settings'),
  });

  // Authorised Signature Upload Handler
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Signature file size must be less than 2MB');
      return;
    }

    try {
      setIsUploadingSig(true);
      const uploadRes = await uploadApi.image(file);
      const signaturePath = uploadRes?.data?.path;
      if (!signaturePath) throw new Error('Upload succeeded but no file path returned');

      await companyApi.update(companyId, { signaturePath });
      updateCurrentCompany({ signaturePath });
      await refetchCompany();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Authorised signature uploaded and saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to upload signature');
    } finally {
      setIsUploadingSig(false);
      if (e.target) e.target.value = '';
    }
  };

  // Remove Signature Handler
  const handleRemoveSignature = async () => {
    if (!companyId) return;
    try {
      setIsUploadingSig(true);
      await companyApi.update(companyId, { signaturePath: null });
      updateCurrentCompany({ signaturePath: undefined });
      await refetchCompany();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Authorised signature removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove signature');
    } finally {
      setIsUploadingSig(false);
    }
  };

  // Company Logo Upload Handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const uploadRes = await uploadApi.image(file);
      const logoPath = uploadRes?.data?.path;
      if (!logoPath) throw new Error('Upload succeeded but no path returned');

      await companyApi.update(companyId, { logoPath });
      updateCurrentCompany({ logoPath });
      await refetchCompany();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Company logo uploaded successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!companyId) return;
    try {
      setIsUploadingLogo(true);
      await companyApi.update(companyId, { logoPath: null });
      updateCurrentCompany({ logoPath: undefined });
      await refetchCompany();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Company logo removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Password update
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Please fill in current and new password');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    }
  };

  const tabs = [
    { id: 'company' as const, label: 'Company Profile', icon: Building2 },
    { id: 'billing' as const, label: 'Billing & Invoicing', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  const currentSigPath = company?.signaturePath || currentCompany?.signaturePath;
  const currentLogoPath = company?.logoPath || currentCompany?.logoPath;

  const getFullImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
    return path.startsWith('/') ? path : `/${path}`;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage company branding, authorised signature, and invoice configurations</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-6)' }}>
        {/* Sidebar tabs */}
        <div className="card" style={{ padding: 'var(--space-3)', height: 'fit-content' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: tab === id ? 'var(--brand-primary-light)' : 'none',
                color: tab === id ? 'var(--brand-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                fontWeight: tab === id ? 600 : 400,
                fontSize: 'var(--text-sm)',
                marginBottom: 4,
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowServerModal(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11 }}
            >
              <Server size={13} /> Cloud Server Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="card">
          {/* 1. Company Profile & Signature */}
          {tab === 'company' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
                <div>
                  <div className="card-title">Company Profile & Signatory</div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Update your business registration, logo, and authorised signature for GST invoices
                  </p>
                </div>
                <Link to="/templates" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> View Invoice Templates
                </Link>
              </div>

              {/* Branding and Signature Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 'var(--space-6)' }}>
                {/* Authorised Signature Card */}
                <div
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    background: 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ImageIcon size={16} style={{ color: 'var(--brand-primary)' }} />
                        Authorised Signature
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Printed on invoices, receipts & vouchers
                      </div>
                    </div>
                    {currentSigPath && (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>Active</span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={signatureInputRef}
                    style={{ display: 'none' }}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleSignatureUpload}
                  />

                  {currentSigPath ? (
                    <div>
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 80,
                          marginBottom: 12,
                        }}
                      >
                        <img
                          src={getFullImageUrl(currentSigPath)}
                          alt="Authorised Signature"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.retried && currentSigPath) {
                              target.dataset.retried = 'true';
                              target.src = `http://localhost:4000${currentSigPath.startsWith('/') ? '' : '/'}${currentSigPath}`;
                            }
                          }}
                          style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => signatureInputRef.current?.click()}
                          disabled={isUploadingSig}
                          style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                          {isUploadingSig ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                          Replace Signature
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={handleRemoveSignature}
                          disabled={isUploadingSig}
                          style={{ color: '#ef4444' }}
                          title="Remove signature"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => signatureInputRef.current?.click()}
                      style={{
                        border: '2px dashed var(--color-border)',
                        borderRadius: 8,
                        padding: '24px 16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'var(--color-surface-hover)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        {isUploadingSig ? (
                          <Loader2 size={24} className="animate-spin text-primary" />
                        ) : (
                          <Upload size={24} style={{ color: 'var(--brand-primary)' }} />
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {isUploadingSig ? 'Uploading...' : 'Upload Authorised Signature'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                        PNG, JPG, WEBP (transparent background recommended, max 2MB)
                      </div>
                    </div>
                  )}
                </div>

                {/* Company Logo Card */}
                <div
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    background: 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building2 size={16} style={{ color: 'var(--brand-primary)' }} />
                        Company Logo
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Appears at the header of all invoices
                      </div>
                    </div>
                    {currentLogoPath && (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>Active</span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={logoInputRef}
                    style={{ display: 'none' }}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                  />

                  {currentLogoPath ? (
                    <div>
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 80,
                          marginBottom: 12,
                        }}
                      >
                        <img
                          src={getFullImageUrl(currentLogoPath)}
                          alt="Company Logo"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.retried && currentLogoPath) {
                              target.dataset.retried = 'true';
                              target.src = `http://localhost:4000${currentLogoPath.startsWith('/') ? '' : '/'}${currentLogoPath}`;
                            }
                          }}
                          style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                          {isUploadingLogo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                          Replace Logo
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                          style={{ color: '#ef4444' }}
                          title="Remove logo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        border: '2px dashed var(--color-border)',
                        borderRadius: 8,
                        padding: '24px 16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'var(--color-surface-hover)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        {isUploadingLogo ? (
                          <Loader2 size={24} className="animate-spin text-primary" />
                        ) : (
                          <Upload size={24} style={{ color: 'var(--brand-primary)' }} />
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {isUploadingLogo ? 'Uploading...' : 'Upload Company Logo'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                        PNG, JPG, SVG or WEBP (Max 2MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Details Form */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
                  Business Information
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Company Name *</label>
                    <input
                      className="form-control"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Legal Name (Trade Name)</label>
                    <input
                      className="form-control"
                      value={companyForm.legalName}
                      onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input
                      className="form-control"
                      value={companyForm.gstin}
                      onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value.toUpperCase() })}
                      placeholder="e.g. 33AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAN Number</label>
                    <input
                      className="form-control"
                      value={companyForm.pan}
                      onChange={(e) => setCompanyForm({ ...companyForm, pan: e.target.value.toUpperCase() })}
                      placeholder="e.g. AAAAA0000A"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select
                      className="form-control"
                      value={companyForm.businessType}
                      onChange={(e) => setCompanyForm({ ...companyForm, businessType: e.target.value })}
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Service">Service</option>
                      <option value="Distribution">Distribution</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Registration Type</label>
                    <select
                      className="form-control"
                      value={companyForm.gstRegistrationType}
                      onChange={(e) => setCompanyForm({ ...companyForm, gstRegistrationType: e.target.value })}
                    >
                      <option value="regular">Regular</option>
                      <option value="composition">Composition</option>
                      <option value="unregistered">Unregistered</option>
                      <option value="sez">SEZ</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-control"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      placeholder="contact@mycompany.com"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Address Line</label>
                    <input
                      className="form-control"
                      value={companyForm.addressLine1}
                      onChange={(e) => setCompanyForm({ ...companyForm, addressLine1: e.target.value })}
                      placeholder="Building, Street, Area"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      className="form-control"
                      value={companyForm.city}
                      onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input
                      className="form-control"
                      value={companyForm.state}
                      onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN Code</label>
                    <input
                      className="form-control"
                      value={companyForm.pinCode}
                      onChange={(e) => setCompanyForm({ ...companyForm, pinCode: e.target.value })}
                      maxLength={6}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ marginTop: 'var(--space-4)' }}
                  onClick={() => updateCompanyMutation.mutate(companyForm)}
                  disabled={updateCompanyMutation.isPending}
                >
                  {updateCompanyMutation.isPending ? 'Saving...' : 'Save Company Information'}
                </button>
              </div>
            </div>
          )}

          {/* 2. Billing & Invoicing */}
          {tab === 'billing' && (
            <div>
              <div className="card-title" style={{ marginBottom: 'var(--space-2)' }}>Billing & Invoice Settings</div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                Configure invoice prefixes, payment options, and footer disclosures.
              </p>

              {/* Template Customizer Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(135deg, rgba(26, 86, 219, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
                  border: '1px solid rgba(26, 86, 219, 0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  marginBottom: 'var(--space-5)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} /> 10+ Professional Invoice Templates & Live Editor
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Customize colors, fonts, margins, column visibility, and authorised signature stamp live in the visual editor.
                  </div>
                </div>
                <Link to="/templates" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  Open Template Editor <ArrowRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Invoice Number Prefix</label>
                  <input
                    className="form-control"
                    value={billingForm.invoicePrefix}
                    onChange={(e) => setBillingForm({ ...billingForm, invoicePrefix: e.target.value })}
                    placeholder="INV"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quotation Prefix</label>
                  <input
                    className="form-control"
                    value={billingForm.quotationPrefix}
                    onChange={(e) => setBillingForm({ ...billingForm, quotationPrefix: e.target.value })}
                    placeholder="QT"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">UPI ID (for QR Code Payment)</label>
                  <input
                    className="form-control"
                    value={billingForm.upiId}
                    onChange={(e) => setBillingForm({ ...billingForm, upiId: e.target.value })}
                    placeholder="merchant@upi"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Payment Terms (Days)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={billingForm.defaultPaymentTerms}
                    onChange={(e) => setBillingForm({ ...billingForm, defaultPaymentTerms: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Default Invoice Footer Note</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={billingForm.invoiceFooter}
                    onChange={(e) => setBillingForm({ ...billingForm, invoiceFooter: e.target.value })}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={() => updateSettingsMutation.mutate(billingForm)}
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Billing Settings'}
              </button>
            </div>
          )}

          {/* 3. Notification Preferences */}
          {tab === 'notifications' && (
            <div>
              <div className="card-title" style={{ marginBottom: 'var(--space-5)' }}>Notification Preferences</div>
              {[
                { label: 'Low Stock Alerts', desc: 'Notify when product stock falls below minimum threshold' },
                { label: 'Payment Reminders', desc: 'Send reminders for overdue or pending invoices' },
                { label: 'New Order Notifications', desc: 'Alert when a new purchase order is created' },
                { label: 'Daily Sales Summary', desc: 'Receive end-of-day sales report by email' },
              ].map((n) => (
                <div
                  key={n.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{n.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{n.desc}</div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: 18, height: 18, accentColor: 'var(--brand-primary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* 4. Security */}
          {tab === 'security' && (
            <div>
              <div className="card-title" style={{ marginBottom: 'var(--space-2)' }}>Security Settings</div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
                Update your login password and manage access security
              </p>

              <form onSubmit={handlePasswordUpdate} style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password (Min 8 characters)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
                  Update Password
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <ServerConfigModal isOpen={showServerModal} onClose={() => setShowServerModal(false)} />
    </div>
  );
}
