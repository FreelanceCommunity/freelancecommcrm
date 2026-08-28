import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/features/auth/Login';
import Unauthorized from '@/features/auth/Unauthorized';
import { useAuth } from '@/features/auth/AuthContext';
import { RoleGuard, type Role } from '@/features/auth/RoleGuard';
import AdminLayout from '@/components/layout/AdminLayout';
import ClientPortalLayout from '@/components/layout/ClientPortalLayout';
import AdminDashboard from '@/features/dashboard/AdminDashboard';
import ClientsList from '@/features/clients/ClientsList';
import ClientCreate from '@/features/clients/ClientCreate';
import ClientView from '@/features/clients/ClientView';
import DealsKanban from '@/features/crm/DealsKanban';
import SubscriptionsList from '@/features/billing/SubscriptionsList';
import SubscriptionCreate from '@/features/billing/SubscriptionCreate';
import InvoicesList from '@/features/billing/InvoicesList';
import InvoiceCreate from '@/features/billing/InvoiceCreate';
import AdminTicketList from '@/features/support/AdminTicketList';
import AdminTicketView from '@/features/support/AdminTicketView';
import ClientDashboard from '@/features/portal/ClientDashboard';
import ClientInvoices from '@/features/portal/ClientInvoices';
import ClientTickets from '@/features/portal/ClientTickets';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const adminRoles: Role[] = ['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER', 'SUPPORT_AGENT'];
const clientRoles: Role[] = ['CLIENT_ADMIN', 'CLIENT_USER'];

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      
      {/* Admin Routes */}
      <Route path="/app" element={
        <AuthGuard>
          <RoleGuard allowedRoles={adminRoles}>
            <AdminLayout />
          </RoleGuard>
        </AuthGuard>
      }>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="clients" element={<ClientsList />} />
        <Route path="clients/new" element={<ClientCreate />} />
        <Route path="clients/:id" element={<ClientView />} />
        <Route path="deals" element={<DealsKanban />} />
        <Route path="projects" element={<div>Projects (TODO)</div>} />
        <Route path="subscriptions" element={<SubscriptionsList />} />
        <Route path="subscriptions/new" element={<SubscriptionCreate />} />
        <Route path="invoices" element={<InvoicesList />} />
        <Route path="invoices/new" element={<InvoiceCreate />} />
        <Route path="tickets" element={<AdminTicketList />} />
        <Route path="tickets/:id" element={<AdminTicketView />} />
        <Route path="settings" element={<div>Settings (TODO)</div>} />
      </Route>
      
      {/* Client Portal Routes */}
      <Route path="/portal" element={
        <AuthGuard>
          <RoleGuard allowedRoles={clientRoles}>
            <ClientPortalLayout />
          </RoleGuard>
        </AuthGuard>
      }>
        <Route index element={<Navigate to="/portal/dashboard" replace />} />
        <Route path="dashboard" element={<ClientDashboard />} />
        <Route path="projects" element={<div>Projects (TODO)</div>} />
        <Route path="subscriptions" element={<div>Subscriptions (TODO)</div>} />
        <Route path="invoices" element={<ClientInvoices />} />
        <Route path="tickets" element={<ClientTickets />} />
        <Route path="profile" element={<div>Profile (TODO)</div>} />
      </Route>
    </Routes>
  );
}

export default App;
