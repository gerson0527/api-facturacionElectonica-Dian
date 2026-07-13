import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { FileText, Lock, Mail } from 'lucide-react';

import { useAuth } from '../providers/AuthProvider';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              padding: '1rem',
              borderRadius: '1.25rem',
              color: 'white',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <FileText size={40} />
            </div>
          </div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Bienvenido al Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Inicia sesión para gestionar tu empresa</p>
        </div>

        {error && (
          <div className="animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger-color)', color: 'var(--danger-color)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Mail size={20} />
              </div>
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="admin@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label">Contraseña</label>
              <a href="#" style={{ fontSize: '0.8rem', fontWeight: 600 }}>¿Olvidaste tu contraseña?</a>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Lock size={20} />
              </div>
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem', padding: '0.875rem', fontSize: '1rem' }}
            disabled={loading}
          >
            {loading ? <div className="spinner"></div> : 'Ingresar al Portal'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>¿No tienes una cuenta? </span>
          <Link to="/register" style={{ fontWeight: 600 }}>Regístrate aquí</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
