import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export default function ClientSubscriptions() {
  const { clientId } = useAuth();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['portal_subscriptions', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading subscriptions...</div>;

  const statusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Trialing': return 'bg-blue-100 text-blue-700';
      case 'Past Due': return 'bg-red-100 text-red-700';
      case 'Paused': return 'bg-amber-100 text-amber-700';
      case 'Cancelled': return 'bg-slate-100 text-slate-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Subscriptions</h1>

      {!subscriptions || subscriptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No active subscriptions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {subscriptions.map((sub: any) => (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                  {sub.currency} ${sub.amount} / {sub.interval}
                </CardTitle>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(sub.status)}`}>
                  {sub.status}
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">{new Date(sub.start_date).toLocaleDateString()}</p>
                  </div>
                  {sub.next_billing_date && (
                    <div>
                      <p className="text-muted-foreground">Next Billing</p>
                      <p className="font-medium">{new Date(sub.next_billing_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                {sub.notes && (
                  <p className="text-sm text-muted-foreground">{sub.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
