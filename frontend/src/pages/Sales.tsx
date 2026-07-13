import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { ShoppingCart, Plus, Download, TrendingUp, CreditCard, Banknote, MoreVertical, X, Search } from 'lucide-react';

interface Invoice {
  id: string;
  prefix: string;
  number: string;
  issueDate: string;
  totalAmount: string;
  status: string;
  paymentMethodCode: string;
  customer: {
    name: string;
    documentNumber: string;
  };
}

export default function Sales() {
  const [sales, setSales] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPosModal, setShowPosModal] = useState(false);
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posProductQuery, setPosProductQuery] = useState('');
  
  const fetchSales = async () => {
    try {
      const [salesRes, prodRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/products')
      ]);
      setSales(salesRes.data.data || []);
      setProducts(prodRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const formatCurrency = (val: string | number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val));

  // POS Functions
  const addToCart = (product: any) => {
    const existing = posCart.find(item => item.id === product.id);
    if (existing) {
      setPosCart(posCart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setPosCart([...posCart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setPosCart(posCart.filter(item => item.id !== id));
  };

  const cartTotal = posCart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (posCart.length === 0) return;
    try {
      // Create movement for each item in cart
      for (const item of posCart) {
        await api.post('/inventory/movements', {
          productId: item.id,
          type: 'OUT',
          quantity: item.qty,
          reason: 'Venta POS',
          reference: `POS-${new Date().getTime()}`
        });
      }
      alert('Venta registrada con éxito y stock actualizado.');
      setShowPosModal(false);
      setPosCart([]);
      fetchSales(); // Refresh stats
    } catch (e) {
      alert('Error registrando la venta. Revise el stock.');
    }
  };

  // Calculate KPIs
  const today = new Date().toISOString().split('T')[0];
  const todaysSales = sales.filter(s => s.issueDate && s.issueDate.startsWith(today));
  const totalToday = todaysSales.reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
  const cashSales = todaysSales.filter(s => s.paymentMethodCode === '10').reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
  const transferSales = todaysSales.filter(s => s.paymentMethodCode !== '10').reduce((acc, curr) => acc + Number(curr.totalAmount), 0);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(posProductQuery.toLowerCase()) || p.code.toLowerCase().includes(posProductQuery.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Caja y Ventas</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Registro diario de transacciones y POS</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary">
            <Download size={18} /> Exportar Arqueo
          </button>
          <button className="btn btn-primary" onClick={() => setShowPosModal(true)}>
            <ShoppingCart size={18} /> Nueva Venta (POS)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>Ingresos de Hoy</h3>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{formatCurrency(totalToday)}</div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#34D399' }}>{todaysSales.length} transacciones</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Efectivo en Caja</h3>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
              <Banknote size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{formatCurrency(cashSales)}</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Bancos y Tarjetas</h3>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{formatCurrency(transferSales)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
          <h2 className="card-title">Historial de Transacciones</h2>
          <div className="input-group" style={{ marginBottom: 0, width: '250px' }}>
            <input type="text" className="input-field" placeholder="Buscar transacción..." />
          </div>
        </div>
        <div className="table-container" style={{ border: 'none', boxShadow: 'none', flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Recibo / Factura</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Método</th>
                <th>Total</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner" style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'var(--primary-color)', margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay ventas registradas.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td><strong style={{ color: 'var(--primary-color)' }}>{sale.prefix}{sale.number}</strong></td>
                    <td>{sale.customer?.name || 'Consumidor Final'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(sale.issueDate).toLocaleDateString()}</td>
                    <td>
                      <span className="badge badge-secondary">
                        {sale.paymentMethodCode === '10' ? 'Efectivo' : 'Transferencia'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(sale.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)' }}>
                        <MoreVertical size={16}/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POS Modal */}
      {showPosModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ width: '800px', height: '600px', display: 'flex', padding: 0, overflow: 'hidden', animation: 'scaleIn 0.2s ease-out' }}>
            
            {/* Products List (Left Side) */}
            <div style={{ flex: 2, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'white' }}>
                <h3 style={{ marginBottom: '1rem' }}>Catálogo POS</h3>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Search size={18} /></div>
                    <input type="text" className="input-field" placeholder="Buscar código o nombre..." style={{ paddingLeft: '2.5rem' }} value={posProductQuery} onChange={e => setPosProductQuery(e.target.value)} />
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', alignContent: 'start' }}>
                {filteredProducts.map(p => (
                  <div key={p.id} className="card" style={{ cursor: 'pointer', padding: '1rem', textAlign: 'center', transition: 'transform 0.1s', border: p.stock <= 0 ? '1px solid var(--danger-color)' : '' }} onClick={() => p.stock > 0 && addToCart(p)}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{p.code}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', height: '40px', overflow: 'hidden' }}>{p.name}</div>
                    <div style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{formatCurrency(p.price)}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: p.stock > 0 ? '#34D399' : 'var(--danger-color)' }}>
                      Stock: {p.stock}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart (Right Side) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Carrito</h3>
                <button onClick={() => setShowPosModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20}/></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {posCart.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>El carrito está vacío</div>
                ) : (
                  posCart.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.qty} x {formatCurrency(item.price)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(item.qty * item.price)}</span>
                        <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)' }}><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(cartTotal)}</span>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }} onClick={handleCheckout} disabled={posCart.length === 0}>
                  Cobrar y Descontar Stock
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
