import React, { useState } from 'react';
import { api } from '../api';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      if (data.access_token) {
        onLogin(data.access_token);
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* DNA Background Effect */}
      <div className="login-dna-bg">
        {/* DNA Nodes */}
        <div className="login-dna-node blue" style={{ left: '10%', top: '20%' }}></div>
        <div className="login-dna-node purple" style={{ left: '25%', top: '40%' }}></div>
        <div className="login-dna-node blue" style={{ left: '40%', top: '60%' }}></div>
        <div className="login-dna-node purple" style={{ left: '55%', top: '25%' }}></div>
        <div className="login-dna-node blue" style={{ left: '70%', top: '55%' }}></div>
        <div className="login-dna-node purple" style={{ left: '85%', top: '35%' }}></div>
        
        {/* DNA Bridges */}
        <div className="login-dna-bridge" style={{ left: '10%', top: '30%', width: '40px' }}></div>
        <div className="login-dna-bridge" style={{ left: '25%', top: '50%', width: '60px' }}></div>
        <div className="login-dna-bridge" style={{ left: '55%', top: '40%', width: '35px' }}></div>
        <div className="login-dna-bridge" style={{ left: '70%', top: '65%', width: '50px' }}></div>
        
        {/* Floating Particles */}
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
        <div className="login-dna-particle"></div>
      </div>
      
      <div className="login-card">
        <h1 className="login-title">Gestión de Pagos</h1>
        <form onSubmit={handleSubmit}>
          {error && <div className="error" style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

      </div>
    </div>
  );
}
