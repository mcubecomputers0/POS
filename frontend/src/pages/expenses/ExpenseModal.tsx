import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { expenseApi } from '../../api';
import toast from 'react-hot-toast';

const schema = z.object({
  description: z.string().min(1, 'Description required'),
  categoryId: z.string().optional(),
  amount: z.coerce.number().min(0),
  gstAmount: z.coerce.number().min(0).default(0),
  vendor: z.string().optional(),
  expenseDate: z.string().min(1, 'Date required'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'upi', 'card', 'cheque', 'credit']).default('cash'),
  notes: z.string().optional(),
});

type Form = z.infer<typeof schema>;

interface Props { onClose: () => void; onSuccess: () => void; }

export default function ExpenseModal({ onClose, onSuccess }: Props) {
  const { data: catData } = useQuery({ queryKey: ['expense-categories'], queryFn: expenseApi.categories });
  const categories = catData?.data ?? [];

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { expenseDate: new Date().toISOString().split('T')[0], paymentMethod: 'cash' },
  });

  const mutation = useMutation({
    mutationFn: expenseApi.create,
    onSuccess: () => { toast.success('Expense added'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Add Expense</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((data) => mutation.mutate({ ...data, totalAmount: data.amount + data.gstAmount }))}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Description</label>
                <input className={`form-control ${errors.description ? 'error' : ''}`} placeholder="e.g. Monthly rent payment" {...register('description')} />
                {errors.description && <span className="form-error">{errors.description.message}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-control" {...register('categoryId')}>
                    <option value="">Select Category</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor / Party</label>
                  <input className="form-control" placeholder="Vendor name" {...register('vendor')} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Amount (₹)</label>
                  <div className="input-group"><span className="input-prefix">₹</span>
                    <input type="number" step="0.01" className={`form-control ${errors.amount ? 'error' : ''}`} placeholder="0.00" {...register('amount')} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">GST Amount (₹)</label>
                  <div className="input-group"><span className="input-prefix">₹</span>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00" {...register('gstAmount')} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label required">Date</label>
                  <input type="date" className="form-control" {...register('expenseDate')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-control" {...register('paymentMethod')}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={2} placeholder="Additional notes..." {...register('notes')} />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
