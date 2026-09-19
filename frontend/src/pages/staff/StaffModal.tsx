import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { staffApi, roleApi } from '../../api';
import toast from 'react-hot-toast';

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.string().min(1, 'Please select a role'),
  designation: z.string().optional(),
  department: z.string().optional(),
});

const editSchema = z.object({
  roleId: z.string().min(1, 'Please select a role'),
  designation: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
});

interface Props {
  staff?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StaffModal({ staff, onClose, onSuccess }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const isEditing = Boolean(staff);

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.list(),
  });
  const roles: any[] = rolesData?.data ?? [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: isEditing
      ? {
          roleId: staff?.roleId || staff?.role?.id || '',
          designation: staff?.designation || '',
          department: staff?.department || '',
          isActive: staff?.isActive ?? true,
        }
      : {
          name: '',
          email: '',
          phone: '',
          password: '',
          roleId: '',
          designation: '',
          department: '',
        },
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEditing ? staffApi.update(staff.id, data) : staffApi.create(data),
    onSuccess: () => {
      toast.success(isEditing ? 'Staff member updated' : 'Staff member created successfully');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save staff member');
    },
  });

  const onSubmit = (formData: any) => {
    mutation.mutate(formData);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {!isEditing && (
                <>
                  {/* Name */}
                  <div className="form-group">
                    <label className="form-label required">Full Name</label>
                    <input
                      className={`form-control ${errors.name ? 'error' : ''}`}
                      placeholder="e.g. John Doe"
                      {...register('name')}
                    />
                    {errors.name && <span className="form-error">{errors.name.message as string}</span>}
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label className="form-label required">Email Address</label>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'error' : ''}`}
                      placeholder="staff@example.com"
                      {...register('email')}
                    />
                    {errors.email && <span className="form-error">{errors.email.message as string}</span>}
                  </div>

                  {/* Phone */}
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className={`form-control ${errors.phone ? 'error' : ''}`}
                      placeholder="+91 98765 43210"
                      {...register('phone')}
                    />
                    {errors.phone && <span className="form-error">{errors.phone.message as string}</span>}
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <label className="form-label required">Initial Password</label>
                    <div className="input-group has-suffix">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control ${errors.password ? 'error' : ''}`}
                        placeholder="Min. 8 characters"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: '4px',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <span className="form-error">{errors.password.message as string}</span>}
                  </div>
                </>
              )}

              {isEditing && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontWeight: 600 }}>{staff?.user?.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{staff?.user?.email}</div>
                </div>
              )}

              {/* Role */}
              <div className="form-group">
                <label className="form-label required">Role</label>
                <select
                  className={`form-control ${errors.roleId ? 'error' : ''}`}
                  {...register('roleId')}
                  disabled={rolesLoading}
                >
                  <option value="">{rolesLoading ? 'Loading roles...' : 'Select a role'}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName || r.name}
                    </option>
                  ))}
                </select>
                {errors.roleId && <span className="form-error">{errors.roleId.message as string}</span>}
              </div>

              {/* Designation */}
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  className="form-control"
                  placeholder="e.g. Senior Cashier, Floor Manager"
                  {...register('designation')}
                />
              </div>

              {/* Department */}
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  className="form-control"
                  placeholder="e.g. Sales, Inventory, Accounts"
                  {...register('department')}
                />
              </div>

              {/* Status (Edit only) */}
              {isEditing && (
                <>
                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <select
                      className="form-control"
                      {...register('isActive', { setValueAs: (v) => v === 'true' || v === true })}
                      defaultValue={staff?.isActive ? 'true' : 'false'}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reset Password <span style={{ color: 'var(--color-text-dim)', fontSize: '11px', fontWeight: 400 }}>(Leave blank to keep unchanged)</span></label>
                    <div className="input-group has-suffix">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control ${errors.password ? 'error' : ''}`}
                        placeholder="Enter new password (min. 8 characters)"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: '4px',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <span className="form-error">{errors.password.message as string}</span>}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 size={16} className="spinner" />}
              {isEditing ? 'Save Changes' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
