import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { FileText, Building, Mail, Lock, Key } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    nit: '',
    adminEmail: '',
    adminPassword: ''
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create Tenant (which also creates the admin user)
      await api.post('/tenants', formData);
      alert('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrar la empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              padding: '1rem',
              borderRadius: '1.25rem',
              color: 'white',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <Building size={40} />
            </div>
          </div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Crea tu Cuenta</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Únete a la plataforma para gestionar tu empresa</p>
        </div>

        {error && (
          <div className="animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger-color)', color: 'var(--danger-color)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Razón Social</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                  <Building size={18} />
                </div>
                <input type="text" className="input-field" style={{ paddingLeft: '2.5rem' }} placeholder="Mi Empresa S.A.S" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">NIT (Sin DV)</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                  <Key size={18} />
                </div>
                <input type="text" className="input-field" style={{ paddingLeft: '2.5rem' }} placeholder="900123456" value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} required />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Correo de Administrador</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Mail size={18} />
              </div>
              <input type="email" className="input-field" style={{ paddingLeft: '2.5rem' }} placeholder="admin@miempresa.com" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Lock size={18} />
              </div>
              <input type="password" className="input-field" style={{ paddingLeft: '2.5rem' }} placeholder="••••••••" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} minLength={6} required />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.875rem', fontSize: '1rem' }} disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Crear Cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>¿Ya tienes una cuenta? </span>
          <Link to="/login" style={{ fontWeight: 600 }}>Inicia Sesión aquí</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
