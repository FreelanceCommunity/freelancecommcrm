import { useState } from 'react';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
  LogOut,
  Activity,
  DollarSign,
  FolderOpen,
  CheckSquare,
  Flag,
  Bug,
  Lightbulb,
  File,
  BarChart,
  Bell,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigationGroups = [
  {
    group: 'Main',
    items: [
      { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard }
    ]
  },
  {
    group: 'CRM',
    items: [
      { name: 'Clients', href: '/app/clients', icon: Users },
      { name: 'Contacts', href: '/app/contacts', icon: Users },
      { name: 'Leads', href: '/app/leads', icon: Users },
      { name: 'Deals', href: '/app/deals', icon: Briefcase },
      { name: 'Activities', href: '/app/activities', icon: Activity },
      { name: 'Meetings', href: '/app/meetings', icon: Calendar },
      { name: 'Messages', href: '/app/messages', icon: MessageSquare },
    ]
  },
  {
    group: 'Billing',
    items: [
      { name: 'Subscriptions', href: '/app/subscriptions', icon: CreditCard },
      { name: 'Invoices', href: '/app/invoices', icon: FileText },
      { name: 'Payments', href: '/app/payments', icon: DollarSign },
      { name: 'Overdue', href: '/app/overdue', icon: FileText },
    ]
  },
  {
    group: 'Projects',
    items: [
      { name: 'Projects', href: '/app/projects', icon: FolderOpen },
      { name: 'Tasks', href: '/app/tasks', icon: CheckSquare },
      { name: 'Milestones', href: '/app/milestones', icon: Flag },
    ]
  },
  {
    group: 'Support',
    items: [
      { name: 'Tickets', href: '/app/tickets', icon: LifeBuoy },
      { name: 'Bugs', href: '/app/bugs', icon: Bug },
      { name: 'Feature Requests', href: '/app/features', icon: Lightbulb },
    ]
  },
  {
    group: 'System',
    items: [
      { name: 'Documents', href: '/app/documents', icon: File },
      { name: 'Reports', href: '/app/reports', icon: BarChart },
      { name: 'Notifications', href: '/app/notifications', icon: Bell },
      { name: 'Settings', href: '/app/settings', icon: Settings },
    ]
  }
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();

  // Show popup toasts when a notification arrives
  useAppNotifications();

  // Fetch unread notifications count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const renderNavItems = () => (
    <div className="space-y-6">
      {navigationGroups.map((group) => (
        <div key={group.group}>
          {group.group !== 'Main' && (
            <h4 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
              {group.group}
            </h4>
          )}
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
            {group.items.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted text-primary'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                  {item.name === 'Notifications' && unreadCount > 0 && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );

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
            <div className="mt-8">{renderNavItems()}</div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden border-r bg-background md:block md:w-64 md:shrink-0">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/app" className="flex items-center gap-2 font-semibold">
              <span className="text-xl tracking-tight font-black">MYSTEL</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            {renderNavItems()}
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
