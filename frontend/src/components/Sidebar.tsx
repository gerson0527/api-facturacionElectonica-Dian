import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, Settings } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <FileText color="var(--primary-color)" />
        <span>DIAN API</span>
      </div>
      
      <div className="sidebar-nav">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/invoices" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <FileText size={20} />
          <span>Facturas</span>
        </NavLink>
        
        <NavLink 
          to="/customers" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <Users size={20} />
          <span>Clientes</span>
        </NavLink>
        
        <NavLink 
          to="/settings" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <Settings size={20} />
          <span>Configuración</span>
        </NavLink>
        
        <div style={{ flex: 1 }}></div>
        
        <button 
          onClick={handleLogout}
          className="nav-item" 
          style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger-color)' }}
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
