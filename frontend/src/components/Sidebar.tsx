import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  FileText, 
  FileMinus, 
  FilePlus, 
  ShoppingCart, 
  Users, 
  Building2, 
  Package, 
  Boxes, 
  CreditCard, 
  BarChart2, 
  ShieldCheck, 
  UserCircle, 
  Settings, 
  LogOut,
  Hexagon
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

const navItems = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/sales', icon: <TrendingUp size={20} />, label: 'Ventas' },
  { to: '/quotations', icon: <FileText size={20} />, label: 'Cotizaciones' },
  { to: '/invoices', icon: <FileText size={20} />, label: 'Facturas Electrónicas' },
  { to: '/credit-notes', icon: <FilePlus size={20} />, label: 'Notas Crédito' },
  { to: '/debit-notes', icon: <FileMinus size={20} />, label: 'Notas Débito' },
  { to: '/purchases', icon: <ShoppingCart size={20} />, label: 'Facturas Compra' },
  { to: '/customers', icon: <Users size={20} />, label: 'Clientes' },
  { to: '/suppliers', icon: <Building2 size={20} />, label: 'Proveedores' },
  { to: '/products', icon: <Package size={20} />, label: 'Productos' },
  { to: '/inventory', icon: <Boxes size={20} />, label: 'Inventario' },
  { to: '/payments', icon: <CreditCard size={20} />, label: 'Pagos' },
  { to: '/reports', icon: <BarChart2 size={20} />, label: 'Reportes' },
  { to: '/dian', icon: <ShieldCheck size={20} />, label: 'DIAN' },
  { to: '/users', icon: <UserCircle size={20} />, label: 'Usuarios' },
  { to: '/settings', icon: <Settings size={20} />, label: 'Configuración' },
];

const Sidebar = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{
          background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Hexagon size={24} fill="currentColor" stroke="none" />
        </div>
        <span style={{ color: 'var(--text-primary)' }}>FactuDian</span>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item, index) => (
          <NavLink 
            key={index}
            to={item.to} 
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        
        <div style={{ flex: 1 }}></div>
        
        <button 
          onClick={handleLogout}
          className="nav-item" 
          style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger-color)', marginTop: '1rem' }}
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
