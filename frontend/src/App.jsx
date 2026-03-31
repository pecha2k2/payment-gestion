import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { api, setToken, getToken } from './api';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PaymentsListPage from './pages/PaymentsListPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import NewPaymentPage from './pages/NewPaymentPage';
import UsersPage from './pages/UsersPage';
import WorkflowConfigsPage from './pages/WorkflowConfigsPage';

function PrivateRoute({ children }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function DNABackground() {
  return (
    <div className="dna-background">
      {/* Floating particles */}
      {[...Array(10)].map((_, i) => (
        <div key={`particle-${i}`} className="dna-particle" style={{ left: `${5 + i * 10}%` }} />
      ))}
      {/* DNA strands */}
      {[...Array(4)].map((_, i) => (
        <div key={`strand-${i}`} className="dna-strand" style={{ left: `${20 + i * 20}%` }} />
      ))}
      {/* DNA helix element */}
      <div className="dna-helix-element" style={{ right: '5%', bottom: '20%', opacity: 0.3 }} />
    </div>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setDarkMode(false);
      document.documentElement.removeAttribute('data-theme');
    } else {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (getToken()) {
      api.getMe().then(setUser).catch(() => {
        setToken(null);
        navigate('/login');
      });
    }
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    navigate('/login');
  };

  if (!getToken()) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={(token) => {
          setToken(token);
          api.getMe().then(setUser).then(() => navigate('/'));
        }} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app">
      <DNABackground />
      <nav className="navbar">
        <Link to="/" className="navbar-brand">Gestión de Pagos</Link>
        <ul className="navbar-nav">
          <li><Link to="/" className={isActive('/') ? 'active' : ''}>Dashboard</Link></li>
          <li><Link to="/payments" className={isActive('/payments') || location.pathname.startsWith('/payments/') ? 'active' : ''}>Peticiones</Link></li>
          {user?.role === 'admin' && (
            <li><Link to="/users" className={isActive('/users') ? 'active' : ''}>Usuarios</Link></li>
          )}
          {user?.role === 'admin' && (
            <li><Link to="/workflow-configs" className={isActive('/workflow-configs') ? 'active' : ''}>Flujos</Link></li>
          )}
        </ul>
        <div className="navbar-user">
          <button className="theme-toggle" onClick={toggleTheme} title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
            <span className="theme-toggle-icon">{darkMode ? '☀️' : '🌙'}</span>
          </button>
          <span>{user?.name} ({user?.role})</span>
          <button className="btn btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage user={user} />} />
          <Route path="/payments" element={<PaymentsListPage user={user} />} />
          <Route path="/payments/new" element={<NewPaymentPage user={user} />} />
          <Route path="/payments/:id" element={<PaymentDetailPage user={user} />} />
          {user?.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
          {user?.role === 'admin' && <Route path="/workflow-configs" element={<WorkflowConfigsPage />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}