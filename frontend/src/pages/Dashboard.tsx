import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  FileText, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  Download,
  MoreVertical,
  Mail,
  Printer,
  FilePlus
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api from '../api/axios';

// --- COMPONENTS ---
const StatCard = ({ title, value, subtext, icon, trend, primary }: any) => (
  <div className="card" style={{ 
    background: primary ? 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' : 'var(--surface-color)',
    color: primary ? 'white' : 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', gap: '1rem'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: primary ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
        {title}
      </h3>
      <div style={{ 
        padding: '0.5rem', 
        borderRadius: '0.5rem', 
        backgroundColor: primary ? 'rgba(255,255,255,0.2)' : 'rgba(37, 99, 235, 0.1)',
        color: primary ? 'white' : 'var(--primary-color)'
      }}>
        {icon}
      </div>
    </div>
    <div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '0.25rem' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', color: trend === 'up' ? (primary ? '#34D399' : 'var(--success-color)') : (trend === 'down' ? (primary ? '#F87171' : 'var(--danger-color)') : 'inherit') }}>
        {subtext}
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats');
        setData(response.data);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  // MOCK categories just because the backend doesn't group by product type yet.
  const categoryData = [
    { name: 'Servicios', value: 65, color: '#2563EB' },
    { name: 'Productos', value: 35, color: '#38BDF8' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Resumen financiero y estado de facturación electrónica.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary">
            <Download size={18} /> Exportar Reporte
          </button>
          <button className="btn btn-primary">
            <FilePlus size={18} /> Nueva Factura
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <StatCard 
          title="Ventas de hoy" 
          value={formatCurrency(data.kpi.todaysSales)} 
          subtext="Total de ventas aprobadas" 
          icon={<DollarSign size={20} />} 
          trend="up"
          primary={true}
        />
        <StatCard 
          title="Facturas del mes" 
          value={data.kpi.monthlyInvoices} 
          subtext="Facturas emitidas" 
          icon={<FileText size={20} />} 
          trend="up"
        />
        <StatCard 
          title="Clientes activos" 
          value={data.kpi.totalCustomers} 
          subtext="Registrados en la plataforma" 
          icon={<Users size={20} />} 
          trend="up"
        />
        <StatCard 
          title="Pendiente por cobrar" 
          value={formatCurrency(data.kpi.pendingAmount)} 
          subtext="Facturas no pagadas" 
          icon={<CreditCard size={20} />} 
          trend="down"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Main Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h2 className="card-title">Ventas últimos 7 días</h2>
            <select className="input-field" style={{ width: 'auto', padding: '0.375rem 0.75rem' }}>
              <option>Últimos 7 días</option>
            </select>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow-md)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DIAN Monitoring & Category Donut */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Estado DIAN</h2>
              <ShieldCheck size={20} color="var(--success-color)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Servicio DIAN</span>
                <span className="badge badge-success">{data.dian.connected ? 'Conectado' : 'Desconectado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Ambiente</span>
                <span className="badge badge-primary">{data.dian.environment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Docs Rechazados</span>
                <span className={`badge ${data.dian.rejectedDocs > 0 ? 'badge-danger' : 'badge-secondary'}`}>{data.dian.rejectedDocs}</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center' }}>
                Última sincronización: {new Date(data.dian.lastSync).toLocaleTimeString('es-CO')}
              </div>
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <h2 className="card-title">Ventas por categoría</h2>
            </div>
            <div style={{ height: '180px', width: '100%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="35%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {categoryData.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></div>
                    <span style={{ color: 'var(--text-secondary)', width: '70px' }}>{item.name}</span>
                    <span style={{ fontWeight: 600 }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
          <h2 className="card-title">Últimas facturas</h2>
          <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Ver todas</button>
        </div>
        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado DIAN</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInvoices.map((invoice: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{invoice.id}</td>
                  <td>{invoice.client}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{invoice.date}</td>
                  <td style={{ fontWeight: 500 }}>{formatCurrency(invoice.total)}</td>
                  <td>
                    <span className={`badge ${invoice.status === 'Aceptada' || invoice.status === 'Enviada' ? 'badge-success' : (invoice.status === 'Rechazada' ? 'badge-danger' : 'badge-warning')}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)' }}><Download size={16}/></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)' }}><Mail size={16}/></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)' }}><Printer size={16}/></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-secondary)' }}><MoreVertical size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.recentInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay facturas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
