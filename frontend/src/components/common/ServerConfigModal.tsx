import { useState } from 'react';
import { Globe, CheckCircle2, AlertCircle, RefreshCw, X, Server } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getStoredServerUrl } from '../../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ServerConfigModal({ isOpen, onClose }: Props) {
  const [url, setUrl] = useState(getStoredServerUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const formatServerUrl = (raw: string): string => {
    let clean = raw.trim().replace(/\/+$/, '');
    if (!clean) return '';
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      if (clean.startsWith('192.168.') || clean.startsWith('10.') || clean.startsWith('localhost') || clean.startsWith('127.0.0.1')) {
        clean = `http://${clean}`;
      } else {
        clean = `https://${clean}`;
      }
    }
    return clean;
  };

  const handleTestConnection = async () => {
    const formatted = formatServerUrl(url);
    const pingUrl = formatted ? `${formatted}/health` : '/health';
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await axios.get(pingUrl, { timeout: 10000 });
      if (res.data?.status === 'ok') {
        setTestResult({
          success: true,
          message: `Connected successfully! Server: ${res.data?.service || 'CloudGST Pro'} (v${res.data?.version || '1.0.0'})`,
        });
        toast.success('Connected to Cloud Server successfully!');
      } else {
        setTestResult({ success: false, message: 'Server responded, but health status was unexpected.' });
      }
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Cannot reach server.';
      if (err.code === 'ECONNABORTED') {
        msg = 'Connection timed out. Check if server is running and accessible.';
      } else if (!err.response) {
        msg = `Cannot reach ${formatted || 'server'}. Ensure backend is running, port 4000 is open, and both devices are on the same Wi-Fi (for local) or connected to Internet (for cloud).`;
      }
      setTestResult({ success: false, message: msg });
      toast.error('Connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = formatServerUrl(url);
    if (cleanUrl) {
      localStorage.setItem('cloudgst_server_url', cleanUrl);
      toast.success(`Server URL updated: ${cleanUrl}`);
    } else {
      localStorage.removeItem('cloudgst_server_url');
      toast.success('Using local/relative server endpoint');
    }
    onClose();
    window.location.reload();
  };

  const handleResetToDefault = () => {
    setUrl('');
    localStorage.removeItem('cloudgst_server_url');
    setTestResult(null);
    toast.success('Reset to default server');
  };

  const applyPreset = (presetUrl: string) => {
    setUrl(presetUrl);
    setTestResult(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 'var(--text-base)' }}>
            <Server size={18} style={{ color: 'var(--brand-primary)' }} />
            Cloud & Server Configuration
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Set your online Cloud Backend API URL so the Windows desktop app or Android app can sync data online in real time.
        </p>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Backend Server URL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-control"
              placeholder="e.g. https://cloudgst-api.onrender.com or http://192.168.1.28:4000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              style={{ fontSize: 'var(--text-xs)' }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-dim)', alignSelf: 'center' }}>Quick Presets:</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => applyPreset('https://pos-4156.onrender.com')}
              style={{ fontSize: 10, padding: '2px 8px', height: 'auto', border: '1px solid #3b82f6', color: '#60a5fa' }}
            >
              ☁ Cloud Render (pos-4156)
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => applyPreset('https://pos-m49l.onrender.com')}
              style={{ fontSize: 10, padding: '2px 8px', height: 'auto', border: '1px solid var(--color-border)' }}
            >
              ☁ Cloud Render (pos-m49l)
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => applyPreset('http://192.168.1.28:4000')}
              style={{ fontSize: 10, padding: '2px 8px', height: 'auto', border: '1px solid var(--color-border)' }}
            >
              📶 Wi-Fi PC (192.168.1.28:4000)
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => applyPreset('http://localhost:4000')}
              style={{ fontSize: 10, padding: '2px 8px', height: 'auto', border: '1px solid var(--color-border)' }}
            >
              💻 Localhost (4000)
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6 }}>
            💡 <strong>Cloud Hosting:</strong> If your backend is deployed online (Render, Railway, AWS, VPS), enter its full HTTPS URL (e.g. <code>https://my-backend.onrender.com</code>).
          </div>
        </div>

        {testResult && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: testResult.success ? '#22c55e' : '#ef4444',
            }}
          >
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleTestConnection}
            disabled={isTesting}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetToDefault}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            Reset
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
