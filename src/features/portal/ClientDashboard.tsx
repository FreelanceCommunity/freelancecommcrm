import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['portal_dashboard_data'],
    queryFn: async () => {
      // Get the client ID for this user via organization_members -> clients
      // Since RLS is active, just querying clients returns only their allowed clients
      const { data: clients } = await supabase.from('clients').select('*, contacts(*), services(*), subscriptions(*), projects(*)');
      const client = clients?.[0];

      if (!client) return null;

      const { data: invoices } = await supabase.from('invoices').select('*').eq('client_id', client.id).limit(5);
      const { count: openTickets } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('client_id', client.id).neq('status', 'Closed');
      const { count: activeProjects } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'Active');
      
      const outstanding = invoices?.reduce((acc, inv) => inv.status !== 'Paid' ? acc + inv.total : acc, 0) || 0;
      
      return { client, invoices, openTickets, activeProjects, outstanding };
    }
  });

  if (isLoading) return <div>Loading dashboard...</div>;
  if (!dashboardData?.client) return <div>No client data found.</div>;

  const { client, invoices, openTickets, activeProjects, outstanding } = dashboardData;
  const activeSub = client.subscriptions?.find((s: any) => s.status === 'Active');

  // Find primary contact
  const primaryContact = client.contacts?.find((c: any) => c.is_primary) || client.contacts?.[0];
  const greetingName = primaryContact && primaryContact.first_name !== 'Not' ? primaryContact.first_name : 'Client';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Welcome, {greetingName}</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.name}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{activeSub ? 'ACTIVE' : 'NONE'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSub ? `$${activeSub.amount} ${activeSub.currency}/${activeSub.interval}` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${outstanding}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{openTickets || 0} open tickets</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Services</CardTitle>
          </CardHeader>
          <CardContent>
            {client.services?.length === 0 ? (
              <p className="text-muted-foreground">No services mapped yet.</p>
            ) : (
              <ul className="space-y-2">
                {client.services?.map((svc: any) => (
                  <li key={svc.id} className="flex items-center gap-2 border p-3 rounded-md bg-muted/20">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="font-medium">{svc.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices?.length === 0 ? (
              <p className="text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="divide-y">
                {invoices?.map(inv => (
                  <div key={inv.id} className="flex justify-between py-3 border-b last:border-0 items-center">
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${inv.total}</div>
                      <span className="px-2 py-1 text-xs bg-muted rounded-full">{inv.status}</span>
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
