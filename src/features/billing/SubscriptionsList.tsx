import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function SubscriptionsList() {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          client:clients(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Subscription
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search subscriptions..." className="w-full pl-8" />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Billing Interval</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Next Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
              ) : subscriptions?.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No subscriptions found</td></tr>
              ) : (
                subscriptions?.map((sub) => (
                  <tr key={sub.id} className="transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">{sub.client?.name || 'Unknown Client'}</td>
                    <td className="p-4">{sub.currency} {sub.amount}</td>
                    <td className="p-4 capitalize">{sub.interval}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                        {sub.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{sub.next_billing_date || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
