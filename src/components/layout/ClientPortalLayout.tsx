import { useState } from 'react';
import { useMeetingNotifications } from '@/hooks/useMeetingNotifications';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { 
  LayoutDashboard, 
  Briefcase, 
  CreditCard, 
  FileText,
  LifeBuoy,
  Settings,
  Menu,
  X,
  LogOut,
  Building,
  DollarSign,
  File,
  MessageSquare,
  Bell,
  User,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/portal', icon: LayoutDashboard },
  { name: 'My Company', href: '/portal/company', icon: Building },
  { name: 'Services', href: '/portal/services', icon: Briefcase },
  { name: 'Projects', href: '/portal/projects', icon: Briefcase },
  { name: 'Meetings', href: '/portal/meetings', icon: Calendar },
  { name: 'Support Tickets', href: '/portal/tickets', icon: LifeBuoy },
  { name: 'Subscriptions', href: '/portal/subscriptions', icon: CreditCard },
  { name: 'Invoices', href: '/portal/invoices', icon: FileText },
  { name: 'Payments', href: '/portal/payments', icon: DollarSign },
  { name: 'Documents', href: '/portal/documents', icon: File },
  { name: 'Messages', href: '/portal/messages', icon: MessageSquare },
  { name: 'Notifications', href: '/portal/notifications', icon: Bell },
  { name: 'Profile', href: '/portal/profile', icon: User },
  { name: 'Settings', href: '/portal/settings', icon: Settings },
];

export default function ClientPortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();

  // Show popup toasts when a meeting is created/updated for this client
  useMeetingNotifications();

  return (
    <div className="flex h-screen bg-muted/40">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-64 max-w-sm flex-col bg-background border-r p-6 overflow-y-auto">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 top-4"
            >
              <X className="h-6 w-6" />
            </button>
            <nav className="mt-8 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || (item.href !== '/portal' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden border-r bg-background md:block md:w-64 md:shrink-0">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/portal" className="flex items-center gap-2 font-semibold">
              <span className="text-xl tracking-tight font-black">MYSTEL Portal</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || (item.href !== '/portal' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted text-primary'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm truncate mr-2 text-muted-foreground">
                {user?.email}
              </div>
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
          <div className="w-full flex-1"></div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
