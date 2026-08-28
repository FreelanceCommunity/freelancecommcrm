import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CreditCard, Activity, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard_metrics'],
    queryFn: async () => {
      // Get org id
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0];
      if (!orgId) return null;

      const { data, error } = await supabase.rpc('get_dashboard_metrics', { org_id: orgId });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : (metrics?.total_clients || 0)}</div>
            <p className="text-xs text-muted-foreground">Active clients</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${isLoading ? '...' : (metrics?.mrr || 0)}</div>
            <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${isLoading ? '...' : (metrics?.outstanding_invoices || 0)}</div>
            <p className="text-xs text-muted-foreground">Pending payments</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : (metrics?.active_projects || 0)}</div>
            <p className="text-xs text-muted-foreground">Ongoing client projects</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] w-full bg-muted/20 rounded flex items-center justify-center text-muted-foreground text-sm">
              Recharts Implementation Pending
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground p-4">
                Activity feed requires populated data
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
