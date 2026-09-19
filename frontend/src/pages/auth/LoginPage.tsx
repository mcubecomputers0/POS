import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Zap, Server } from 'lucide-react';
import { authApi, companyApi, getStoredServerUrl } from '../../api';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';
import ServerConfigModal from '../../components/common/ServerConfigModal';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const currentServerUrl = getStoredServerUrl();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await authApi.login(data);
      const { user, accessToken, refreshToken, companies = [] } = result.data;

      setAuth({ user, accessToken, refreshToken, companies });

      toast.success(`Welcome back, ${user.name}!`);

      if (companies.length === 0) {
        navigate('/create-company');
      } else if (companies.length === 1) {
        navigate('/');
      } else {
        navigate('/select-company');
      }
    } catch (error: any) {
      if (!error.response) {
        toast.error('Cannot reach backend server. Please configure your Cloud Server URL.', { duration: 5000 });
        setShowServerModal(true);
      } else {
        toast.error(error.response?.data?.message || 'Invalid email or password');
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 'var(--space-4)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(26, 86, 219, 0.3), transparent)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            borderRadius: 'var(--radius-2xl)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4)',
            boxShadow: 'var(--shadow-glow)',
            fontSize: 32,
          }}>
            ⚡
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>
            வணிகம் (Vanigam)
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          {/* Server status indicator */}
          {currentServerUrl ? (
            <div style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowServerModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 20,
                  fontSize: 11,
                  color: '#22c55e',
                  height: 'auto',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span>Cloud Server: {currentServerUrl}</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                marginBottom: 'var(--space-4)',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: 'var(--radius-lg)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#eab308',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={14} />
                <span>Cloud Server not set</span>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(true)}
                style={{
                  background: '#eab308',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Connect
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Email Address</label>
                <input
                  type="email"
                  className={`form-control ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label required">Password</label>
                  <a href="#" style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-primary)' }}>
                    Forgot password?
                  </a>
                </div>
                <div className="input-group has-suffix">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control ${errors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="input-suffix"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, pointerEvents: 'all' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password.message}</span>}
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 size={18} className="spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Signing in...</> : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Server / Cloud config trigger */}
          <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowServerModal(true)}
              style={{ fontSize: 11, color: 'var(--color-text-dim)', gap: 5 }}
            >
              <Server size={12} /> Cloud Server Settings
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Create free account</Link>
        </p>

        <ServerConfigModal isOpen={showServerModal} onClose={() => setShowServerModal(false)} />
      </div>
    </div>
  );
}
