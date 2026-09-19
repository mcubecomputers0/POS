import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { supplierApi } from '../../api';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' }, { code: '09', name: 'Uttar Pradesh' },
  { code: '19', name: 'West Bengal' }, { code: '24', name: 'Gujarat' }, { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '36', name: 'Telangana' }, { code: '37', name: 'Andhra Pradesh' },
];

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  creditDays: z.coerce.number().min(0).default(0),
});

type Form = z.infer<typeof schema>;

interface Props { supplier?: any; onClose: () => void; onSuccess: () => void; }

export default function SupplierModal({ supplier, onClose, onSuccess }: Props) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: supplier ? {
      name: supplier.name, phone: supplier.phone || '', email: supplier.email || '',
      gstin: supplier.gstin || '', pan: supplier.pan || '', addressLine1: supplier.addressLine1 || '',
      city: supplier.city || '', state: supplier.state || '', stateCode: supplier.stateCode || '',
      creditLimit: supplier.creditLimit ?? 0, creditDays: supplier.creditDays ?? 0,
    } : {},
  });

  const mutation = useMutation({
    mutationFn: (data: Form) => supplier ? supplierApi.update(supplier.id, data) : supplierApi.create(data),
    onSuccess: () => { toast.success(supplier ? 'Supplier updated' : 'Supplier created'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Supplier Name</label>
                <input className={`form-control ${errors.name ? 'error' : ''}`} placeholder="Supplier / Business Name" {...register('name')} />
                {errors.name && <span className="form-error">{errors.name.message}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" placeholder="9876543210" {...register('phone')} /></div>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" placeholder="supplier@example.com" {...register('email')} /></div>
                <div className="form-group"><label className="form-label">GSTIN</label><input className="form-control" placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} {...register('gstin')} /></div>
                <div className="form-group"><label className="form-label">PAN</label><input className="form-control" placeholder="AAAAA1234A" style={{ textTransform: 'uppercase' }} {...register('pan')} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Address</label><input className="form-control" placeholder="Street, Building No." {...register('addressLine1')} /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-control" placeholder="City" {...register('city')} /></div>
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
                <div className="form-group"><label className="form-label">Credit Limit (₹)</label><input type="number" className="form-control" placeholder="0" {...register('creditLimit')} /></div>
                <div className="form-group"><label className="form-label">Credit Days</label><input type="number" className="form-control" placeholder="30" {...register('creditDays')} /></div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {supplier ? 'Update' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
