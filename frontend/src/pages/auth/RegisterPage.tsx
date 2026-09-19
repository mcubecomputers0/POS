import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { authApi, companyApi } from '../../api';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const result = await authApi.register({ name: data.name, email: data.email, phone: data.phone, password: data.password });
      const { user, accessToken, refreshToken } = result.data;
      setAuth({ user, accessToken, refreshToken, companies: [] });
      toast.success(`Welcome to வியாபாரம் (VIYABARAM CLOUD), ${user.name}!`);
      navigate('/create-company');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124, 58, 237, 0.25), transparent)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <img
            src="./icon.png"
            alt="வியாபாரம் (VIYABARAM CLOUD)"
            style={{
              width: 72,
              height: 72,
              borderRadius: 'var(--radius-2xl)',
              margin: '0 auto var(--space-3)',
              boxShadow: '0 8px 24px rgba(26, 86, 219, 0.35)',
              display: 'block',
              objectFit: 'cover',
            }}
          />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem', fontWeight: 800, marginBottom: 2 }}>
            வியாபாரம் (VIYABARAM CLOUD)
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
            Start your 30-day free trial — GST Billing & Inventory Software
          </p>
        </div>

        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">Full Name</label>
                <input type="text" className={`form-control ${errors.name ? 'error' : ''}`} placeholder="Your full name" autoComplete="name" {...register('name')} />
                {errors.name && <span className="form-error">{errors.name.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required">Email Address</label>
                <input type="email" className={`form-control ${errors.email ? 'error' : ''}`} placeholder="you@example.com" autoComplete="email" {...register('email')} />
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-control" placeholder="9876543210" autoComplete="tel" {...register('phone')} />
              </div>

              <div className="form-group">
                <label className="form-label required">Password</label>
                <div className="input-group has-suffix">
                  <input type={showPassword ? 'text' : 'password'} className={`form-control ${errors.password ? 'error' : ''}`} placeholder="Min 8 characters" autoComplete="new-password" {...register('password')} />
                  <button type="button" className="input-suffix" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, pointerEvents: 'all' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required">Confirm Password</label>
                <input type={showPassword ? 'text' : 'password'} className={`form-control ${errors.confirmPassword ? 'error' : ''}`} placeholder="Re-enter password" {...register('confirmPassword')} />
                {errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating account...</> : 'Create Free Account'}
              </button>
            </div>
          </form>

          <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)', textAlign: 'center' }}>
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}<Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Sign in</Link>
        </p>

        {/* Software credits & license rights */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-dim)',
          lineHeight: 1.6,
        }}>
          <div>Software Developed By: <strong style={{ color: 'var(--color-text)' }}>MCube Computers</strong></div>
          <div>License Rights: <strong style={{ color: 'var(--color-text)' }}>MCube Computers</strong></div>
        </div>
      </div>
    </div>
  );
}
