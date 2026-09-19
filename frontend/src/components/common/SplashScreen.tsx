import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
  isModal?: boolean;
}

export default function SplashScreen({
  onFinish,
  durationMs = 2600,
  isModal = false,
}: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Viyabaram Cloud...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (pct < 30) {
        setStatusText('Loading billing & inventory modules...');
      } else if (pct < 65) {
        setStatusText('Connecting to Cloud database & services...');
      } else if (pct < 90) {
        setStatusText('Applying MCube business configurations...');
      } else {
        setStatusText('Ready! Welcome to Viyabaram Cloud.');
      }

      if (elapsed >= durationMs) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [durationMs]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onFinish?.();
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'radial-gradient(ellipse at 50% 30%, #0c1a3a 0%, #060b18 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'auto',
      }}
    >
      {/* Top Skip / Dismiss Button */}
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10 }}>
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#cbd5e1',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#cbd5e1';
          }}
        >
          {isModal ? 'Close ✕' : <>Skip <ArrowRight size={13} /></>}
        </button>
      </div>

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          background: 'rgba(15, 23, 42, 0.75)',
          borderRadius: 20,
          border: '1px solid rgba(59, 130, 246, 0.25)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(37, 99, 235, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(16px)',
          animation: 'splashCardEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Splash Banner Image */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#020617' }}>
          <img
            src="./splash.jpg"
            alt="வியாபாரம் (VIYABARAM CLOUD) — GST Billing & Inventory Software"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              background: '#040b1e',
            }}
          />
        </div>

        {/* Progress & Info Bar */}
        <div style={{ padding: '16px 24px 20px', background: 'rgba(10, 15, 30, 0.9)' }}>
          {/* Progress bar container */}
          <div
            style={{
              width: '100%',
              height: 5,
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 999,
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2563eb, #06b6d4, #10b981)',
                borderRadius: 999,
                transition: 'width 0.1s linear',
                boxShadow: '0 0 10px rgba(6, 182, 212, 0.7)',
              }}
            />
          </div>

          {/* Status & percentage */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#94a3b8',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} style={{ color: '#38bdf8', animation: 'spin 3s linear infinite' }} />
              <span>{statusText}</span>
            </div>
            <span style={{ fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
              {progress}%
            </span>
          </div>

          {/* Credits & License Rights */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 12,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: '11px',
              color: '#94a3b8',
            }}
          >
            <div>
              Software Developed By:{' '}
              <strong style={{ color: '#38bdf8', fontWeight: 600 }}>MCube Computers</strong>
            </div>
            <div>
              License Rights:{' '}
              <strong style={{ color: '#e2e8f0', fontWeight: 600 }}>MCube Computers</strong>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splashCardEnter {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
