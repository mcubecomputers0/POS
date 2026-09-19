import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { User, Camera, Shield, Loader2, CheckCircle } from 'lucide-react';
import { authApi, uploadApi } from '../api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, setAuth, accessToken, refreshToken, companies } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { register: rProfile, handleSubmit: hProfile, formState: { errors: eProfile } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', phone: user?.phone || '' },
  });

  const { register: rPass, handleSubmit: hPass, reset: resetPass, formState: { errors: ePass, isSubmitting: passSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: (res) => {
      toast.success('Profile updated!');
      // Refresh user in store
      useAuthStore.setState({ user: { ...user!, ...res.data } });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) => authApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
    onSuccess: () => {
      toast.success('Password changed successfully!');
      resetPass();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to change password'),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB.'); return; }
    setUploadingPhoto(true);
    try {
      const result = await uploadApi.image(file);
      await authApi.updateProfile({ profilePhoto: result.data.url });
      useAuthStore.setState({ user: { ...user!, profilePhoto: result.data.url } });
      toast.success('Profile photo updated!');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1 className="page-title">My Profile</h1><p className="page-subtitle">Manage your account settings</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Profile Photo Card */}
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 'var(--space-4)' }}>
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt={user.name} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-primary)' }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: 'white', fontFamily: 'var(--font-display)', margin: '0 auto' }}>
                {initials}
              </div>
            )}
            <button
              style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary)', border: '2px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Camera size={12} />}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />

          <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: 4 }}>{user?.name}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>{user?.email}</div>

          {user?.isSuperAdmin && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span className="badge badge-primary"><Shield size={10} /> Super Admin</span>
            </div>
          )}

          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>Companies</div>
            {useAuthStore.getState().companies.map((c) => (
              <div key={c.companyId} style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1) 0' }}>
                <div style={{ fontWeight: 500 }}>{c.companyName}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>{c.role.displayName}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Profile Info */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Personal Information</div>
            <form onSubmit={hProfile((data) => profileMutation.mutate(data))}>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label required">Full Name</label>
                  <input className={`form-control ${eProfile.name ? 'error' : ''}`} {...rProfile('name')} />
                  {eProfile.name && <span className="form-error">{eProfile.name.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-control" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                  <span className="form-hint">Email cannot be changed</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" placeholder="Phone number" {...rProfile('phone')} />
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <button type="submit" className="btn btn-primary" disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={14} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Change Password</div>
            <form onSubmit={hPass((data) => passwordMutation.mutate(data))}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 400 }}>
                <div className="form-group">
                  <label className="form-label required">Current Password</label>
                  <input type="password" className={`form-control ${ePass.currentPassword ? 'error' : ''}`} placeholder="••••••••" {...rPass('currentPassword')} />
                  {ePass.currentPassword && <span className="form-error">{ePass.currentPassword.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label required">New Password</label>
                  <input type="password" className={`form-control ${ePass.newPassword ? 'error' : ''}`} placeholder="Min 8 characters" {...rPass('newPassword')} />
                  {ePass.newPassword && <span className="form-error">{ePass.newPassword.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label required">Confirm New Password</label>
                  <input type="password" className={`form-control ${ePass.confirmPassword ? 'error' : ''}`} placeholder="Re-enter new password" {...rPass('confirmPassword')} />
                  {ePass.confirmPassword && <span className="form-error">{ePass.confirmPassword.message}</span>}
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={passSubmitting || passwordMutation.isPending}>
                  {(passSubmitting || passwordMutation.isPending) && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
                  Change Password
                </button>
              </div>
            </form>
          </div>

          {/* Active Sessions */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Security</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => { authApi.logoutAll().then(() => useAuthStore.getState().logout()).catch(() => {}); }}>
                <Shield size={14} /> Sign Out All Devices
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
