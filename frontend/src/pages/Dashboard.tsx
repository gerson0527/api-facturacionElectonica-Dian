import React, { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import api from '../api/axios';
import { TrendingUp, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalInvoices: 0,
    accepted: 0,
    pending: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching stats from API since there's no dedicated stats endpoint yet
    setTimeout(() => {
      setStats({
        totalInvoices: 142,
        accepted: 120,
        pending: 15,
        rejected: 7
      });
      setLoading(false);
    }, 1000);
  }, []);

  const StatCard = ({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) => (
    <div className="card animate-fade-in" style={{ flex: 1, minWidth: '200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>{title}</p>
          <h3 style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>
            {loading ? <div className="spinner" style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'var(--primary-color)' }}></div> : value}
          </h3>
        </div>
        <div style={{ backgroundColor: `${color}15`, color: color, padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <Topbar title="Dashboard" />
      
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <StatCard 
          title="Facturas Emitidas" 
          value={stats.totalInvoices} 
          icon={<FileText size={24} />} 
          color="var(--primary-color)" 
        />
        <StatCard 
          title="Aceptadas DIAN" 
          value={stats.accepted} 
          icon={<CheckCircle size={24} />} 
          color="var(--success-color)" 
        />
        <StatCard 
          title="Pendientes" 
          value={stats.pending} 
          icon={<TrendingUp size={24} />} 
          color="var(--warning-color)" 
        />
        <StatCard 
          title="Rechazadas" 
          value={stats.rejected} 
          icon={<AlertCircle size={24} />} 
          color="var(--danger-color)" 
        />
      </div>

      <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="card-header">
          <h2 className="card-title">Actividad Reciente</h2>
          <button className="btn btn-secondary">Ver Todo</button>
        </div>
        
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner" style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'var(--primary-color)', margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td><strong>SETP990000001</strong></td>
                    <td>Empresa ABC S.A.S</td>
                    <td>13/07/2026</td>
                    <td>$ 1,500,000</td>
                    <td><span className="badge badge-success">Aceptada</span></td>
                  </tr>
                  <tr>
                    <td><strong>SETP990000002</strong></td>
                    <td>Cliente Frecuente S.A</td>
                    <td>12/07/2026</td>
                    <td>$ 850,000</td>
                    <td><span className="badge badge-success">Aceptada</span></td>
                  </tr>
                  <tr>
                    <td><strong>SETP990000003</strong></td>
                    <td>Distribuidora Nacional</td>
                    <td>12/07/2026</td>
                    <td>$ 2,100,000</td>
                    <td><span className="badge badge-warning">Enviando</span></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
