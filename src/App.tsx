import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/features/auth/Login';
import Signup from '@/features/auth/Signup';
import ForgotPassword from '@/features/auth/ForgotPassword';
import ResetPassword from '@/features/auth/ResetPassword';
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
import ClientTicketView from '@/features/portal/ClientTicketView';
import ProjectsList from '@/features/projects/ProjectsList';
import AdminSettings from '@/features/settings/AdminSettings';
import ClientProjects from '@/features/portal/ClientProjects';
import ClientSubscriptions from '@/features/portal/ClientSubscriptions';
import ClientProfile from '@/features/portal/ClientProfile';
import ClientMeetings from '@/features/portal/ClientMeetings';
import MeetingsList from '@/features/meetings/MeetingsList';
import AdminMessages from '@/features/messages/AdminMessages';

// CRM Admin
import ContactsListComponent from '@/features/crm/ContactsList';
import LeadsListComponent from '@/features/crm/LeadsList';
import ActivitiesListComponent from '@/features/crm/ActivitiesList';

// Billing Admin
import PaymentsListComponent from '@/features/billing/PaymentsList';
import OverdueListComponent from '@/features/billing/OverdueList';

// Projects Admin
import TasksListComponent from '@/features/projects/TasksList';
import MilestonesListComponent from '@/features/projects/MilestonesList';

// Support Admin
import BugsListComponent from '@/features/support/BugsList';
import FeaturesListComponent from '@/features/support/FeaturesList';

// System Admin
import DocumentsListComponent from '@/features/system/DocumentsList';
import ReportsListComponent from '@/features/system/ReportsList';
import NotificationsListComponent from '@/features/system/NotificationsList';

// Client Portal
import ClientCompanyComponent from '@/features/portal/ClientCompany';
import ClientServicesComponent from '@/features/portal/ClientServices';
import ClientTasksComponent from '@/features/portal/ClientTasks';
import ClientBugsComponent from '@/features/portal/ClientBugs';
import ClientFeaturesComponent from '@/features/portal/ClientFeatures';
import ClientPaymentsComponent from '@/features/portal/ClientPayments';
import ClientDocumentsComponent from '@/features/portal/ClientDocuments';
import ClientMessagesComponent from '@/features/portal/ClientMessages';
import ClientNotificationsComponent from '@/features/portal/ClientNotifications';
import ClientSettingsComponent from '@/features/portal/ClientSettings';

function SmartRedirect() {
  const { session, isAdmin, isClient } = useAuth();

  if (!session) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/app/dashboard" replace />;
  if (isClient) return <Navigate to="/portal" replace />;
  return <Navigate to="/unauthorized" replace />;
}

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
      <Route path="/" element={<SmartRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="contacts" element={<ContactsListComponent />} />
        <Route path="leads" element={<LeadsListComponent />} />
        <Route path="deals" element={<DealsKanban />} />
        <Route path="activities" element={<ActivitiesListComponent />} />
        
        <Route path="projects" element={<ProjectsList />} />
        <Route path="tasks" element={<TasksListComponent />} />
        <Route path="milestones" element={<MilestonesListComponent />} />
        <Route path="meetings" element={<MeetingsList />} />
        <Route path="messages/:clientId?" element={<AdminMessages />} />
        
        <Route path="subscriptions" element={<SubscriptionsList />} />
        <Route path="subscriptions/new" element={<SubscriptionCreate />} />
        <Route path="invoices" element={<InvoicesList />} />
        <Route path="invoices/new" element={<InvoiceCreate />} />
        <Route path="payments" element={<PaymentsListComponent />} />
        <Route path="overdue" element={<OverdueListComponent />} />
        
        <Route path="tickets" element={<AdminTicketList />} />
        <Route path="tickets/:id" element={<AdminTicketView />} />
        <Route path="bugs" element={<BugsListComponent />} />
        <Route path="features" element={<FeaturesListComponent />} />
        
        <Route path="documents" element={<DocumentsListComponent />} />
        <Route path="reports" element={<ReportsListComponent />} />
        <Route path="notifications" element={<NotificationsListComponent />} />
        <Route path="settings" element={<AdminSettings />} />
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
        
        <Route path="company" element={<ClientCompanyComponent />} />
        <Route path="services" element={<ClientServicesComponent />} />
        <Route path="projects" element={<ClientProjects />} />
        <Route path="tasks" element={<ClientTasksComponent />} />
        <Route path="meetings" element={<ClientMeetings />} />
        
        <Route path="subscriptions" element={<ClientSubscriptions />} />
        <Route path="invoices" element={<ClientInvoices />} />
        <Route path="payments" element={<ClientPaymentsComponent />} />
        
        <Route path="tickets" element={<ClientTickets />} />
        <Route path="tickets/:id" element={<ClientTicketView />} />
        <Route path="bugs" element={<ClientBugsComponent />} />
        <Route path="features" element={<ClientFeaturesComponent />} />
        
        <Route path="documents" element={<ClientDocumentsComponent />} />
        <Route path="messages" element={<ClientMessagesComponent />} />
        <Route path="notifications" element={<ClientNotificationsComponent />} />
        
        <Route path="profile" element={<ClientProfile />} />
        <Route path="settings" element={<ClientSettingsComponent />} />
      </Route>
    </Routes>
  );
}

export default App;
