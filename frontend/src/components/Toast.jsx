import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// Context & Provider
// ─────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null); // { message, resolve }

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Replacement for window.confirm — returns a Promise<boolean>
  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirm({ message, resolve });
    });
  }, []);

  const handleConfirmResponse = (result) => {
    if (confirm) {
      confirm.resolve(result);
      setConfirm(null);
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showConfirm }}>
      {children}

      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: '360px',
        }}
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '10px',
              padding: '1.75rem',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <p style={{ margin: '0 0 1.5rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
              {confirm.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleConfirmResponse(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleConfirmResponse(true)}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Individual toast item
// ─────────────────────────────────────────────────────────────

const TOAST_STYLES = {
  success: { background: '#166534', border: '1px solid #15803d', icon: '✅' },
  error:   { background: '#7f1d1d', border: '1px solid #b91c1c', icon: '❌' },
  warning: { background: '#78350f', border: '1px solid #b45309', icon: '⚠️' },
  info:    { background: '#1e3a5f', border: '1px solid #1d4ed8', icon: 'ℹ️' },
};

function ToastItem({ toast, onClose }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        borderRadius: '8px',
        color: '#f1f5f9',
        fontSize: '0.875rem',
        lineHeight: 1.45,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        animation: 'slideInRight 0.2s ease',
        ...style,
      }}
    >
      <span style={{ flexShrink: 0, fontSize: '1rem' }}>{style.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '0',
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
