import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Package, Search, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function Inventory() {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ productId: '', type: 'IN', quantity: 1, reason: '', reference: '' });

  const fetchData = async () => {
    try {
      const [movRes, prodRes] = await Promise.all([
        api.get('/inventory/movements'),
        api.get('/products')
      ]);
      setMovements(movRes.data);
      setProducts(prodRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/movements', formData);
      setShowModal(false);
      setFormData({ productId: '', type: 'IN', quantity: 1, reason: '', reference: '' });
      fetchData();
    } catch (e) {
      alert('Error creating movement');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Inventario</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Control de stock y kardex de movimientos</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Registrar Movimiento
        </button>
      </div>

      <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
          <div className="input-group" style={{ marginBottom: 0, width: '300px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Search size={18} />
              </div>
              <input type="text" className="input-field" placeholder="Buscar movimiento o producto..." style={{ paddingLeft: '2.5rem' }} />
            </div>
          </div>
        </div>
        
        <div className="table-container" style={{ border: 'none', boxShadow: 'none', flex: 1, marginTop: '1rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Motivo / Referencia</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay movimientos registrados.</td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(m.createdAt).toLocaleString('es-CO')}</td>
                    <td>
                      {m.type === 'IN' ? (
                        <span className="badge badge-success"><ArrowDownLeft size={12} style={{marginRight:4}}/> Entrada</span>
                      ) : (
                        <span className="badge badge-danger"><ArrowUpRight size={12} style={{marginRight:4}}/> Salida</span>
                      )}
                    </td>
                    <td><strong>{m.product?.code}</strong> - {m.product?.name}</td>
                    <td style={{ fontWeight: 600 }}>{m.type === 'IN' ? '+' : '-'}{m.quantity}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.reason} <small>({m.reference})</small></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ width: '450px', animation: 'scaleIn 0.2s ease-out' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Registrar Movimiento</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label">Producto</label>
                <select className="input-field" required value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})}>
                  <option value="">Seleccione un producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Tipo de Movimiento</label>
                  <select className="input-field" required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="IN">Entrada (IN)</option>
                    <option value="OUT">Salida (OUT)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Cantidad</label>
                  <input type="number" min="1" className="input-field" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="input-label">Motivo</label>
                <input className="input-field" placeholder="Ej. Compra, Ajuste, Daño..." required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Documento Referencia</label>
                <input className="input-field" placeholder="Ej. Factura 1234" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
