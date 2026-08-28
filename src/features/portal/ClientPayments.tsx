import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export default function ClientPayments() {
  const { clientId } = useAuth();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['portal_payments', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*, invoice:invoices(invoice_number)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading payments...</div>;

  const statusColor = (status: string) => {
    switch (status) {
      case 'Succeeded': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Failed': return 'bg-red-100 text-red-700';
      case 'Refunded': return 'bg-blue-100 text-blue-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>

      {!payments || payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No payment history.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Invoice</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                    <th className="p-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</td>
                      <td className="p-3">{payment.invoice?.invoice_number || '-'}</td>
                      <td className="p-3 text-right font-medium">{payment.currency} ${payment.amount}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(payment.status)}`}>
                          {payment.status}
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
