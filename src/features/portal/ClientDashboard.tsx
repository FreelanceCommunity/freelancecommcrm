import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientDashboard() {
  const { data: invoices } = useQuery({
    queryKey: ['portal_invoices_dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('invoices').select('*').limit(5);
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to your Portal</h1>
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
  );
}
