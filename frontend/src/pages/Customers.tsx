import React, { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import api from '../api/axios';
import { Users, Plus, Edit, Trash2, Search, X } from 'lucide-react';

interface Customer {
  id: string;
  documentType: string;
  documentNumber: string;
  dv: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    documentType: '31',
    documentNumber: '',
    dv: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    municipalityCode: '11001',
    fiscalResponsibilities: ['O-99']
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', formData);
      setShowModal(false);
      fetchCustomers();
      // Reset form
      setFormData({
        documentType: '31',
        documentNumber: '',
        dv: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        municipalityCode: '11001',
        fiscalResponsibilities: ['O-99']
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error guardando cliente');
    }
  };

  const getDocTypeName = (code: string) => {
    const types: Record<string, string> = { '13': 'Cédula', '31': 'NIT', '41': 'Pasaporte' };
    return types[code] || code;
  };

  return (
    <div className="animate-fade-in">
      <Topbar title="Clientes" />

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="input-group" style={{ marginBottom: 0, width: '300px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Search size={18} />
              </div>
              <input type="text" className="input-field" placeholder="Buscar cliente..." style={{ paddingLeft: '2.5rem' }} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Nuevo Cliente
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Nombre / Razón Social</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner" style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'var(--primary-color)', margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay clientes registrados.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="badge badge-secondary" style={{ marginRight: 8, backgroundColor: '#e2e8f0' }}>{getDocTypeName(c.documentType)}</span>
                      {c.documentNumber}{c.dv ? `-${c.dv}` : ''}
                    </td>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}><Edit size={14} /></button>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Crear Nuevo Cliente</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Tipo Doc</label>
                  <select className="input-field" value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})}>
                    <option value="13">Cédula</option>
                    <option value="31">NIT</option>
                    <option value="41">Pasaporte</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Número de Documento</label>
                  <input required type="text" className="input-field" value={formData.documentNumber} onChange={e => setFormData({...formData, documentNumber: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">DV</label>
                  <input type="text" className="input-field" value={formData.dv} onChange={e => setFormData({...formData, dv: e.target.value})} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Razón Social / Nombre</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Correo Electrónico</label>
                  <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Teléfono</label>
                  <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Dirección</label>
                <input type="text" className="input-field" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
