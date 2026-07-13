import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceCreate from './pages/InvoiceCreate';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import { AuthProvider } from './providers/AuthProvider';

// Nuevas pantallas
import Sales from './pages/Sales';
import Quotations from './pages/Quotations';
import CreditNotes from './pages/CreditNotes';
import DebitNotes from './pages/DebitNotes';
import Purchases from './pages/Purchases';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import DianMonitoring from './pages/DianMonitoring';
import Users from './pages/Users';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Facturación */}
            <Route path="sales" element={<Sales />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/new" element={<InvoiceCreate />} />
            <Route path="credit-notes" element={<CreditNotes />} />
            <Route path="debit-notes" element={<DebitNotes />} />
            
            {/* Egresos */}
            <Route path="purchases" element={<Purchases />} />
            
            {/* Entidades */}
            <Route path="customers" element={<Customers />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="users" element={<Users />} />
            
            {/* Inventario */}
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<Inventory />} />
            
            {/* Finanzas y Control */}
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="dian" element={<DianMonitoring />} />
            
            {/* Config */}
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
