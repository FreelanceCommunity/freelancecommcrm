import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CreditCard, FileText, LifeBuoy, FolderOpen, ArrowRight } from 'lucide-react';

export default function ClientDashboard() {
  const { clientId, profile } = useAuth();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['portal_dashboard_data', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const [
        { data: client },
        { data: subscriptions },
        { data: invoices },
        { count: openTickets },
        { count: activeProjects },
        { data: services },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('subscriptions').select('*').eq('client_id', clientId).eq('status', 'Active'),
        supabase.from('invoices').select('*').eq('client_id', clientId).order('invoice_date', { ascending: false }).limit(5),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('client_id', clientId).not('status', 'in', '("Closed","Resolved")'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'Active'),
        supabase.from('services').select('*').eq('client_id', clientId),
      ]);

      const outstanding = invoices?.reduce((acc, inv) => inv.status !== 'Paid' && inv.status !== 'Void' ? acc + Number(inv.total || 0) - Number(inv.amount_paid || 0) : acc, 0) || 0;
      const activeSub = subscriptions?.[0] || null;

      return { client, activeSub, invoices, openTickets, activeProjects, outstanding, services };
    },
    enabled: !!clientId,
  });

  const greetingName = profile?.first_name || 'there';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-16 animate-pulse rounded bg-muted" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData?.client) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-bold">Welcome to MYSTEL</h2>
        <p className="mt-2 text-muted-foreground">Your account is being set up. Please contact your administrator.</p>
      </div>
    );
  }

  const { client, activeSub, invoices, openTickets, activeProjects, outstanding, services } = dashboardData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {greetingName} 👋</h1>
        <p className="text-muted-foreground mt-1">{client.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activeSub ? (
              <>
                <div className="text-xl font-bold text-green-600">ACTIVE</div>
                <p className="text-sm text-muted-foreground mt-1">
                  ${activeSub.amount} {activeSub.currency} / {activeSub.interval}
                </p>
                {activeSub.next_billing_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Next billing: {new Date(activeSub.next_billing_date).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <div className="text-xl font-bold text-muted-foreground">No active plan</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${outstanding > 0 ? 'text-amber-600' : ''}`}>
              ${outstanding.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Unpaid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets || 0}</div>
            <p className="text-xs text-muted-foreground">Active support requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
          <Link to="/portal/tickets">
            <LifeBuoy className="h-5 w-5" />
            <span>Create Support Ticket</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
          <Link to="/portal/subscriptions">
            <CreditCard className="h-5 w-5" />
            <span>View Subscription</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
          <Link to="/portal/projects">
            <FolderOpen className="h-5 w-5" />
            <span>View Projects</span>
          </Link>
        </Button>
      </div>

      {/* Services & Recent Invoices */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Services</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/services" className="flex items-center gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!services || services.length === 0 ? (
              <p className="text-muted-foreground text-sm">No services assigned yet.</p>
            ) : (
              <ul className="space-y-2">
                {services.map((svc: any) => (
                  <li key={svc.id} className="flex items-center gap-2 border p-3 rounded-lg bg-muted/20">
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-medium text-sm">{svc.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/invoices" className="flex items-center gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!invoices || invoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">No invoices yet.</p>
            ) : (
              <div className="divide-y">
                {invoices.map((inv: any) => (
                  <div key={inv.id} className="flex justify-between py-3 items-center">
                    <div>
                      <div className="font-medium text-sm">{inv.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">${inv.total}</div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        inv.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        inv.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
