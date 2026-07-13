import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Users, Plus, Search, Edit2, Trash2 } from 'lucide-react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ documentType: 'NIT', documentNumber: '', name: '', email: '', phone: '' });

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', formData);
      setShowModal(false);
      setFormData({ documentType: 'NIT', documentNumber: '', name: '', email: '', phone: '' });
      fetchSuppliers();
    } catch (e) {
      alert('Error creating supplier');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Directorio de proveedores y contratistas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </div>

      <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
          <div className="input-group" style={{ marginBottom: 0, width: '300px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Search size={18} />
              </div>
              <input type="text" className="input-field" placeholder="Buscar proveedor..." style={{ paddingLeft: '2.5rem' }} />
            </div>
          </div>
        </div>
        
        <div className="table-container" style={{ border: 'none', boxShadow: 'none', flex: 1, marginTop: '1rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Razón Social / Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay proveedores registrados.</td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.documentType}</strong> {s.documentNumber}</td>
                    <td>{s.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.email || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.phone || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)' }}><Edit2 size={16}/></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--danger-color)' }}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ width: '400px', animation: 'scaleIn 0.2s ease-out' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Nuevo Proveedor</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '100px' }}>
                  <label className="input-label">Tipo</label>
                  <select className="input-field" value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})}>
                    <option value="NIT">NIT</option>
                    <option value="CC">CC</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Número de Documento</label>
                  <input className="input-field" required value={formData.documentNumber} onChange={e => setFormData({...formData, documentNumber: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="input-label">Razón Social o Nombre</label>
                <input className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Correo Electrónico</label>
                <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Teléfono</label>
                <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
