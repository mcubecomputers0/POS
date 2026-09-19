import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { customerApi } from '../../api';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
];

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  customerType: z.enum(['B2C', 'B2B', 'export', 'other']).default('B2C'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  pinCode: z.string().optional().or(z.literal('')),
  creditLimit: z.coerce.number().min(0).default(0),
  creditDays: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().optional(),
});

type Form = z.infer<typeof schema>;

interface Props { customer?: any; onClose: () => void; onSuccess: (newCustomer?: any) => void; }

export default function CustomerModal({ customer, onClose, onSuccess }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: customer ? {
      name: customer.name, customerType: customer.customerType, phone: customer.phone || '',
      email: customer.email || '', gstin: customer.gstin || '', pan: customer.pan || '',
      addressLine1: customer.addressLine1 || '', city: customer.city || '',
      state: customer.state || '', stateCode: customer.stateCode || '', pinCode: customer.pinCode || '',
      creditLimit: customer.creditLimit ?? 0, creditDays: customer.creditDays ?? 0,
      openingBalance: customer.openingBalance ?? 0, notes: customer.notes || '',
    } : { customerType: 'B2C' },
  });

  const customerType = watch('customerType');

  const mutation = useMutation({
    mutationFn: (data: Form) => customer ? customerApi.update(customer.id, data) : customerApi.create(data),
    onSuccess: (res: any) => {
      toast.success(customer ? 'Customer updated' : 'Customer created');
      onSuccess(res?.data);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{customer ? 'Edit Customer' : 'Add Customer'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Basic Info */}
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label required">Customer Name / Business Name</label>
                    <input className={`form-control ${errors.name ? 'error' : ''}`} placeholder="Full name or business name" {...register('name')} />
                    {errors.name && <span className="form-error">{errors.name.message}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Customer Type</label>
                    <select className="form-control" {...register('customerType')}>
                      <option value="B2C">B2C (Individual Consumer)</option>
                      <option value="B2B">B2B (Business)</option>
                      <option value="export">Export</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" placeholder="9876543210" {...register('phone')} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className={`form-control ${errors.email ? 'error' : ''}`} placeholder="customer@example.com" {...register('email')} />
                    {errors.email && <span className="form-error">{errors.email.message}</span>}
                  </div>

                  {(customerType === 'B2B' || customerType === 'export') && (
                    <>
                      <div className="form-group">
                        <label className="form-label">GSTIN</label>
                        <input className="form-control" placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} {...register('gstin')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">PAN</label>
                        <input className="form-control" placeholder="AAAAA1234A" style={{ textTransform: 'uppercase' }} {...register('pan')} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Address Line</label>
                    <input className="form-control" placeholder="Street, Building No." {...register('addressLine1')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-control" placeholder="City" {...register('city')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-control" {...register('state')} onChange={(e) => {
                      const state = INDIAN_STATES.find((s) => s.name === e.target.value);
                      setValue('state', e.target.value);
                      if (state) setValue('stateCode', state.code);
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

              {/* Credit */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit & Balance</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Credit Limit (₹)</label>
                    <div className="input-group"><span className="input-prefix">₹</span>
                      <input type="number" className="form-control" placeholder="0" {...register('creditLimit')} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Days</label>
                    <input type="number" className="form-control" placeholder="30" {...register('creditDays')} />
                  </div>
                  {!customer && (
                    <div className="form-group">
                      <label className="form-label">Opening Balance (₹)</label>
                      <div className="input-group"><span className="input-prefix">₹</span>
                        <input type="number" className="form-control" placeholder="0" {...register('openingBalance')} />
                      </div>
                      <span className="form-hint">Positive = customer owes you</span>
                    </div>
                  )}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={2} placeholder="Additional notes..." {...register('notes')} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {customer ? 'Update Customer' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
