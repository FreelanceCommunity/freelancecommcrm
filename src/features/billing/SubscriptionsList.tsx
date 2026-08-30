import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Search, Plus, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';

export default function SubscriptionsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingSub, setEditingSub] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [status, setStatus] = useState('');

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

  const updateSub = useMutation({
    mutationFn: async () => {
      if (!editingSub) return;
      const { error } = await supabase
        .from('subscriptions')
        .update({
          start_date: startDate,
          next_billing_date: nextBillingDate,
          status
        })
        .eq('id', editingSub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Subscription updated successfully.' });
      setEditingSub(null);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const openEdit = (sub: any) => {
    setEditingSub(sub);
    setStartDate(sub.start_date || '');
    setNextBillingDate(sub.next_billing_date || '');
    setStatus(sub.status || 'Active');
  };

  const handleExport = () => {
    if (subscriptions) {
      exportToCSV(subscriptions, 'subscriptions.csv');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!subscriptions || subscriptions.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link to="/app/subscriptions/new">
              <Plus className="mr-2 h-4 w-4" />
              New Subscription
            </Link>
          </Button>
        </div>
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
                <th className="p-4 font-medium">Actions</th>
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
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(sub)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs"
                          onClick={async () => {
                            if (!sub.next_billing_date) return;
                            const newDate = new Date(sub.next_billing_date);
                            newDate.setDate(newDate.getDate() + 30);
                            const { error } = await supabase
                              .from('subscriptions')
                              .update({ next_billing_date: newDate.toISOString().split('T')[0] })
                              .eq('id', sub.id);
                            if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
                            else {
                              toast({ title: 'Success', description: 'Extended subscription by 30 days.' });
                              queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
                            }
                          }}
                        >
                          +30 Days
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editingSub} onOpenChange={(open) => !open && setEditingSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateSub.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Trialing">Trialing</option>
                <option value="Past Due">Past Due</option>
                <option value="Paused">Paused</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Next Billing Date</Label>
              <Input type="date" value={nextBillingDate} onChange={(e) => setNextBillingDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setEditingSub(null)}>Cancel</Button>
              <Button type="submit" disabled={updateSub.isPending}>
                {updateSub.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
