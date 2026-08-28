import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function ClientInvoices() {
  const { clientId } = useAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['portal_invoices', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading invoices...</div>;

  const statusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Sent': case 'Viewed': return 'bg-blue-100 text-blue-700';
      case 'Overdue': return 'bg-red-100 text-red-700';
      case 'Draft': return 'bg-slate-100 text-slate-600';
      case 'Partially Paid': return 'bg-amber-100 text-amber-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>

      {!invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No invoices yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Invoice #</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Due Date</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                    <th className="p-3 font-medium text-right">Paid</th>
                    <th className="p-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{inv.invoice_number}</td>
                      <td className="p-3 text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                      <td className="p-3 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                      <td className="p-3 text-right font-medium">${inv.total}</td>
                      <td className="p-3 text-right text-muted-foreground">${inv.amount_paid || 0}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
