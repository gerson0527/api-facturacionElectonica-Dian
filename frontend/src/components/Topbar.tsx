import React from 'react';
import { Bell, User } from 'lucide-react';

interface TopbarProps {
  title: string;
}

const Topbar: React.FC<TopbarProps> = ({ title }) => {
  return (
    <div className="topbar">
      <h1 className="page-title">{title}</h1>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }}>
          <Bell size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Administrador</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mi Empresa S.A.S</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
