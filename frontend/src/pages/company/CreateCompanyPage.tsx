import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { companyApi } from '../../api';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' }, { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' }, { code: '33', name: 'Tamil Nadu' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '32', name: 'Kerala' }, { code: '24', name: 'Gujarat' },
  { code: '19', name: 'West Bengal' }, { code: '09', name: 'Uttar Pradesh' }, { code: '06', name: 'Haryana' },
];

const schema = z.object({
  name: z.string().min(2, 'Company name required'),
  legalName: z.string().optional(),
  businessType: z.enum(['retail', 'wholesale', 'manufacturing', 'service', 'other']).default('retail'),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  gstRegistrationType: z.enum(['regular', 'composition', 'unregistered']).default('regular'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  pinCode: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function CreateCompanyPage() {
  const navigate = useNavigate();
  const { setCompanies, companies } = useAuthStore();

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { businessType: 'retail', gstRegistrationType: 'regular' },
  });

  const onSubmit = async (data: Form) => {
    try {
      const result = await companyApi.create(data);
      const companiesResult = await companyApi.list();
      const newCompanies = companiesResult.data.map((c: any) => ({
        companyId: c.id, companyName: c.name, logoPath: c.logoPath,
        gstin: c.gstin, isOwner: c.isOwner, role: c.role,
      }));
      setCompanies(newCompanies);
      toast.success(`Company "${data.name}" created!`);
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create company');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--space-3)' }}>🏢</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800 }}>Create Your Company</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>Set up your business profile to start billing</p>
        </div>

        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Details</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label required">Business / Company Name</label>
                    <input className={`form-control ${errors.name ? 'error' : ''}`} placeholder="e.g. Sharma Electronics Pvt Ltd" {...register('name')} />
                    {errors.name && <span className="form-error">{errors.name.message}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select className="form-control" {...register('businessType')}>
                      <option value="retail">Retail</option><option value="wholesale">Wholesale</option>
                      <option value="manufacturing">Manufacturing</option><option value="service">Service</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Registration</label>
                    <select className="form-control" {...register('gstRegistrationType')}>
                      <option value="regular">Regular</option>
                      <option value="composition">Composition Scheme</option>
                      <option value="unregistered">Unregistered</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input className="form-control" placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} {...register('gstin')} />
                    <span className="form-hint">15-digit GST Identification Number</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAN</label>
                    <input className="form-control" placeholder="AAAAA1234A" style={{ textTransform: 'uppercase' }} {...register('pan')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" placeholder="9876543210" {...register('phone')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" placeholder="business@example.com" {...register('email')} />
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Address</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Address</label>
                    <input className="form-control" placeholder="Street, Building No." {...register('addressLine1')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-control" placeholder="City" {...register('city')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-control" {...register('state')} onChange={(e) => {
                      const s = INDIAN_STATES.find((st) => st.name === e.target.value);
                      setValue('state', e.target.value);
                      if (s) setValue('stateCode', s.code);
                    }}>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN Code</label>
                    <input className="form-control" placeholder="560001" maxLength={6} {...register('pinCode')} />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating...</> : '🚀 Create Company & Start Billing'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
