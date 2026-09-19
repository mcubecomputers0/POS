import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 'var(--space-4)' }}>🔍</div>
      <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 800 }}>404</h1>
      <div className="empty-state-title">Page Not Found</div>
      <div className="empty-state-message">The page you're looking for doesn't exist or has been moved.</div>
      <Link to="/" className="btn btn-primary"><Home size={16} /> Go to Dashboard</Link>
    </div>
  );
}
