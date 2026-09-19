import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import AppLayout from './components/layout/AppLayout';
import SplashScreen from './components/common/SplashScreen';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import CompanySelectPage from './pages/auth/CompanySelectPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/products/ProductsPage';
import CustomersPage from './pages/customers/CustomersPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage';
import POSPage from './pages/pos/POSPage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import QuotationsPage from './pages/quotations/QuotationsPage';
import SalesReturnsPage from './pages/returns/SalesReturnsPage';
import PaymentsPage from './pages/payments/PaymentsPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import ReportsPage from './pages/reports/ReportsPage';
import GSTReportPage from './pages/reports/GSTReportPage';
import StaffPage from './pages/staff/StaffPage';
import RolesPage from './pages/roles/RolesPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminPage from './pages/superadmin/SuperAdminPage';
import NotFoundPage from './pages/NotFoundPage';
import CreateCompanyPage from './pages/company/CreateCompanyPage';
import CreatePurchasePage from './pages/purchases/CreatePurchasePage';
import CreateQuotationPage from './pages/quotations/CreateQuotationPage';
import InventoryPage from './pages/inventory/InventoryPage';
import ProfilePage from './pages/ProfilePage';
import BarcodeLabelPage from './pages/barcodes/BarcodeLabelPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import TemplatesGalleryPage from './pages/templates/TemplatesGalleryPage';
import TemplateEditorPage from './pages/templates/TemplateEditorPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentCompanyId } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!currentCompanyId) return <Navigate to="/select-company" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('viyabaram_splash_dismissed');
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem('viyabaram_splash_dismissed', 'true');
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
      <Route path="/select-company" element={<CompanySelectPage />} />
      <Route path="/create-company" element={<CreateCompanyPage />} />

      {/* Super Admin */}
      <Route path="/super-admin/*" element={<SuperAdminRoute><AppLayout><SuperAdminPage /></AppLayout></SuperAdminRoute>} />

      {/* Main App */}
      <Route path="/*" element={
        <PrivateRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/purchases/new" element={<CreatePurchasePage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/quotations/new" element={<CreateQuotationPage />} />
              <Route path="/sales-returns" element={<SalesReturnsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/gst" element={<GSTReportPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/audit-logs" element={<AuditLogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/templates" element={<TemplatesGalleryPage />} />
              <Route path="/templates/editor" element={<TemplateEditorPage />} />
              <Route path="/templates/editor/:id" element={<TemplateEditorPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/barcodes" element={<BarcodeLabelPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppLayout>
        </PrivateRoute>
      } />
    </Routes>
    </>
  );
}
