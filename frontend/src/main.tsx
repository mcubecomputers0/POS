import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';
import { initKeyboardGuard } from './utils/keyboardGuard';

initKeyboardGuard();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Use HashRouter for Electron and file:// protocol to avoid navigation breaking local file loading
const isElectron =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' ||
   Boolean((window as any).electronAPI) ||
   navigator.userAgent.toLowerCase().includes('electron'));

const RouterComponent = isElectron ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterComponent>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
          }}
        />
      </RouterComponent>
    </QueryClientProvider>
  </React.StrictMode>
);
