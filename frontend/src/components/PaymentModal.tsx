import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, IndianRupee } from 'lucide-react';
import { paymentApi } from '../api';
import toast from 'react-hot-toast';

const schema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'credit']),
  paymentDate: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type Form = z.infer<typeof schema>;

interface Props {
  invoiceId?: string;
  purchaseId?: string;
  partyName: string;
  balanceDue: number; // paise
  paymentType: 'receipt' | 'payment';
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ invoiceId, purchaseId, partyName, balanceDue, paymentType, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const maxAmount = balanceDue / 100;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: maxAmount,
      method: 'cash',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Form) => paymentApi.create({
      ...data,
      amount: Math.round(data.amount * 100),
      paymentType,
      invoiceId: invoiceId ?? null,
      purchaseId: purchaseId ?? null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment recorded successfully');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to record payment'),
  });

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {paymentType === 'receipt' ? 'Record Payment Received' : 'Record Payment Made'}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="modal-body">
            {/* Party info */}
            <div style={{ background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  {paymentType === 'receipt' ? 'Collecting from' : 'Paying to'}
                </div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{partyName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>Balance Due</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-warning)' }}>
                  ₹{maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Amount (₹)</label>
                <div className="input-group">
                  <span className="input-prefix"><IndianRupee size={14} /></span>
                  <input type="number" step="0.01" max={maxAmount} className={`form-control ${errors.amount ? 'error' : ''}`} {...register('amount')} />
                </div>
                {errors.amount && <span className="form-error">{errors.amount.message}</span>}
                <span className="form-hint">Max: ₹{maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label required">Payment Method</label>
                  <select className="form-control" {...register('method')}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Date</label>
                  <input type="date" className="form-control" {...register('paymentDate')} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / UTR / Cheque No.</label>
                <input className="form-control" placeholder="Transaction reference number" {...register('reference')} />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} placeholder="Any additional notes..." {...register('notes')} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {paymentType === 'receipt' ? '💰 Record Receipt' : '💸 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
