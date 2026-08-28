import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CreditCard, 
  FileText,
  LifeBuoy,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/app/clients', icon: Users },
  { name: 'Deals', href: '/app/deals', icon: Briefcase },
  { name: 'Projects', href: '/app/projects', icon: Briefcase },
  { name: 'Subscriptions', href: '/app/subscriptions', icon: CreditCard },
  { name: 'Invoices', href: '/app/invoices', icon: FileText },
  { name: 'Tickets', href: '/app/tickets', icon: LifeBuoy },
  { name: 'Settings', href: '/app/settings', icon: Settings },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="flex h-screen bg-muted/40">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-64 max-w-sm flex-col bg-background border-r p-6">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 top-4"
            >
              <X className="h-6 w-6" />
            </button>
            <nav className="mt-8 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
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
            <Link to="/app" className="flex items-center gap-2 font-semibold">
              <span className="text-xl tracking-tight">SaaS CRM</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-4">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
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
              <div className="text-sm truncate mr-2">
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
          <div className="w-full flex-1">
            {/* Topbar search or breadcrumbs can go here */}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
