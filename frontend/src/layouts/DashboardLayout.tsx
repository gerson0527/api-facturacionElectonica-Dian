import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../providers/AuthProvider';
import { Search, Bell, Sun, ChevronDown, User } from 'lucide-react';

const DashboardLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
        <div className="spinner" style={{ width: '3rem', height: '3rem', borderTopColor: 'var(--primary-color)' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <header className="topbar glass">
          {/* Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Buscar facturas, clientes, productos..." 
                className="input-field"
                style={{ paddingLeft: '2.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-color)' }}
              />
            </div>
          </div>
          
          {/* Topbar Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}>
              <Sun size={20} />
            </button>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', position: 'relative' }}>
              <Bell size={20} />
              <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', backgroundColor: 'var(--danger-color)', borderRadius: '50%' }}></span>
            </button>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }}></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <User size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user?.email || 'Usuario'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>Empresa Principal S.A.S</span>
              </div>
              <ChevronDown size={16} color="var(--text-secondary)" />
            </div>
          </div>
        </header>
        
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
