import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientSubscriptions() {
  const { data: subs, isLoading } = useQuery({
    queryKey: ['client_subscriptions'],
    queryFn: async () => {
      // RLS filters correctly
      const { data, error } = await supabase.from('subscriptions').select('*');
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Subscriptions</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {subs?.length === 0 ? <p className="text-muted-foreground">No active subscriptions.</p> : (
          subs?.map((s: any) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>Subscription Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${s.amount} <span className="text-sm font-normal text-muted-foreground">{s.currency}/{s.interval}</span></div>
                <div className="text-sm text-muted-foreground mt-2">Status: {s.status}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
