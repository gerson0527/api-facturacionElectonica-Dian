import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import api from '../api/axios';
import { Plus, Trash2, Save, Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Customer {
  id: string;
  name: string;
  documentNumber: string;
}

const InvoiceCreate = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    customerId: '',
    issueDate: new Date().toISOString().split('T')[0],
    issueTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" }) + '-05:00',
    invoiceType: '01',
    paymentType: '1',
    paymentMethod: '10',
    currency: 'COP',
    prefix: 'SETP',
    notes: ''
  });

  const [lines, setLines] = useState([
    { description: '', quantity: 1, unitPrice: 0, taxPercentage: 19, discount: 0 }
  ]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers');
        setCustomers(res.data);
      } catch (err) {
        console.error('Error fetching customers', err);
      }
    };
    fetchCustomers();
  }, []);

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0, taxPercentage: 19, discount: 0 }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;
    
    lines.forEach(line => {
      const lineSub = (line.quantity * line.unitPrice) - line.discount;
      const lineTax = lineSub * (line.taxPercentage / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
    });

    return { subtotal, taxTotal, total: subtotal + taxTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      alert('Por favor selecciona un cliente');
      return;
    }
    
    setLoading(true);
    const totals = calculateTotals();

    const payload = {
      ...formData,
      idempotencyKey: uuidv4(),
      lines: lines.map((l, index) => {
        const lineExtensionAmount = (l.quantity * l.unitPrice) - l.discount;
        const taxAmount = lineExtensionAmount * (l.taxPercentage / 100);
        return {
          lineNumber: index + 1,
          description: l.description,
          quantity: l.quantity,
          unitCode: '94',
          unitPrice: l.unitPrice,
          lineExtensionAmount,
          taxCode: '01',
          taxPercent: l.taxPercentage,
          taxAmount
        };
      }),
      taxTotals: [
        { taxId: '01', taxPercent: 19, taxableAmount: totals.subtotal, taxAmount: totals.taxTotal }
      ]
    };

    try {
      await api.post('/invoices', payload);
      alert('Factura emitida exitosamente');
      navigate('/invoices');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al emitir factura');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxTotal, total } = calculateTotals();

  return (
    <div className="animate-fade-in">
      <Topbar title="Nueva Factura Electrónica" />

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Datos Generales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Cliente</label>
              <select className="input-field" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})} required>
                <option value="">Seleccione un cliente...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.documentNumber})</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Prefijo de Resolución</label>
              <input type="text" className="input-field" value={formData.prefix} onChange={e => setFormData({...formData, prefix: e.target.value})} placeholder="SETP" required />
            </div>
            <div className="input-group">
              <label className="input-label">Fecha de Emisión</label>
              <input type="date" className="input-field" value={formData.issueDate} onChange={e => setFormData({...formData, issueDate: e.target.value})} required />
            </div>
            <div className="input-group">
              <label className="input-label">Medio de Pago</label>
              <select className="input-field" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                <option value="10">Efectivo</option>
                <option value="42">Consignación bancaria</option>
                <option value="48">Tarjeta de crédito</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Observaciones (Opcional)</label>
            <input type="text" className="input-field" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Notas que aparecerán en el PDF" />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem' }}>Detalle de Productos / Servicios</h3>
            <button type="button" className="btn btn-secondary" onClick={addLine}>
              <Plus size={16} /> Añadir Fila
            </button>
          </div>
          
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Descripción</th>
                  <th>Cant.</th>
                  <th>Precio Unit.</th>
                  <th>Descuento</th>
                  <th>% IVA</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const lineSubtotal = (line.quantity * line.unitPrice) - line.discount;
                  return (
                    <tr key={index}>
                      <td>
                        <input type="text" className="input-field" required placeholder="Producto o Servicio" value={line.description} onChange={e => updateLine(index, 'description', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="1" step="0.01" className="input-field" required value={line.quantity} onChange={e => updateLine(index, 'quantity', parseFloat(e.target.value))} />
                      </td>
                      <td>
                        <input type="number" min="0" step="0.01" className="input-field" required value={line.unitPrice} onChange={e => updateLine(index, 'unitPrice', parseFloat(e.target.value))} />
                      </td>
                      <td>
                        <input type="number" min="0" step="0.01" className="input-field" value={line.discount} onChange={e => updateLine(index, 'discount', parseFloat(e.target.value))} />
                      </td>
                      <td>
                        <select className="input-field" value={line.taxPercentage} onChange={e => updateLine(index, 'taxPercentage', parseFloat(e.target.value))}>
                          <option value="19">19%</option>
                          <option value="5">5%</option>
                          <option value="0">0%</option>
                        </select>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <strong>$ {lineSubtotal.toLocaleString('es-CO')}</strong>
                      </td>
                      <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                        <button type="button" onClick={() => removeLine(index)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
              <strong>$ {subtotal.toLocaleString('es-CO')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>IVA:</span>
              <strong>$ {taxTotal.toLocaleString('es-CO')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '1.25rem' }}>
              <span>Total:</span>
              <strong style={{ color: 'var(--primary-color)' }}>$ {total.toLocaleString('es-CO')}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/invoices')}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <div className="spinner"></div> : <><Send size={18} /> Emitir Factura DIAN</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceCreate;
