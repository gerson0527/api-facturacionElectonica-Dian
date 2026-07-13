import React, { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import api from '../api/axios';
import { FileText, Download, CheckCircle, Search, XCircle, Clock } from 'lucide-react';

interface Invoice {
  id: string;
  prefix: string;
  number: string;
  issueDate: string;
  totalAmount: string;
  cufe: string;
  status: string;
  customer: {
    name: string;
    documentNumber: string;
  };
}

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await api.get('/invoices');
        setInvoices(response.data.data || []);
      } catch (error) {
        console.error('Error fetching invoices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  const handleDownloadPdf = async (id: string, prefix: string, number: string) => {
    try {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${prefix}${number}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const emitEvent = async (id: string, eventCode: string, endpoint: string) => {
    try {
      await api.post(`/invoices/${id}/events/${endpoint}`);
      alert(`Evento ${eventCode} emitido correctamente.`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al emitir evento');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <span className="badge badge-success"><CheckCircle size={12} style={{marginRight: 4}}/> Aceptada</span>;
      case 'rejected': return <span className="badge badge-danger"><XCircle size={12} style={{marginRight: 4}}/> Rechazada</span>;
      default: return <span className="badge badge-warning"><Clock size={12} style={{marginRight: 4}}/> Pendiente</span>;
    }
  };

  return (
    <div className="animate-fade-in">
      <Topbar title="Facturas Electrónicas" />

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="input-group" style={{ marginBottom: 0, width: '300px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Search size={18} />
              </div>
              <input type="text" className="input-field" placeholder="Buscar por cliente o número..." style={{ paddingLeft: '2.5rem' }} />
            </div>
          </div>
          <button className="btn btn-primary">
            <FileText size={18} /> Nueva Factura
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Cliente</th>
                <th>Fecha Emisión</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner" style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'var(--primary-color)', margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay facturas registradas.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><strong>{inv.prefix}{inv.number}</strong></td>
                    <td>{inv.customer?.name} <br/> <small style={{color:'var(--text-secondary)'}}>NIT: {inv.customer?.documentNumber}</small></td>
                    <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                    <td>$ {parseFloat(inv.totalAmount).toLocaleString('es-CO')}</td>
                    <td>{getStatusBadge(inv.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleDownloadPdf(inv.id, inv.prefix, inv.number)}
                          title="Descargar PDF"
                        >
                          <Download size={14} /> PDF
                        </button>
                        
                        {/* RADIAN Events Demo */}
                        {inv.status === 'accepted' && (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={(e) => {
                              const menu = e.currentTarget.nextElementSibling as HTMLElement;
                              menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                            }}>
                              RADIAN ▼
                            </button>
                            <div className="card" style={{ display: 'none', position: 'absolute', top: '100%', right: 0, zIndex: 50, padding: '0.5rem', minWidth: '180px', marginTop: '0.5rem' }}>
                              <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '0.25rem', justifyContent: 'flex-start' }} onClick={() => emitEvent(inv.id, '030', 'acuse-recibo')}>Acuse de Recibo (030)</button>
                              <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '0.25rem', justifyContent: 'flex-start' }} onClick={() => emitEvent(inv.id, '032', 'recibo-bien')}>Recibo del Bien (032)</button>
                              <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '0.25rem', justifyContent: 'flex-start' }} onClick={() => emitEvent(inv.id, '033', 'aceptacion-expresa')}>Aceptación Expresa (033)</button>
                              <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => emitEvent(inv.id, '031', 'reclamo')}>Reclamo (031)</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
