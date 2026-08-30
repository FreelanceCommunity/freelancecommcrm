import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const subscriptionSchema = z.object({
  client_id: z.string().min(1, "Client is required"),
  amount: z.number().min(0, "Amount must be a positive number"),
  currency: z.enum(['USD', 'INR']),
  interval: z.enum(['Monthly', '3 Months', '6 Months', 'Yearly']),
  start_date: z.string(),
  payment_due_date: z.string().optional()
});

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

export default function SubscriptionCreate() {
  const navigate = useNavigate();

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name');
      if (error) throw error;
      return data;
    }
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      currency: 'USD',
      interval: 'Monthly',
      start_date: new Date().toISOString().split('T')[0]
    }
  });

  const createSubscription = useMutation({
    mutationFn: async (data: SubscriptionFormValues) => {
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0];
      if (!orgId) throw new Error("No organization found");

      // Calculate next billing date (or use provided payment_due_date)
      let finalNextBillingDate = data.payment_due_date;
      if (!finalNextBillingDate) {
        const start = new Date(data.start_date);
        let nextBilling = new Date(start);
        if (data.interval === 'Monthly') nextBilling.setMonth(start.getMonth() + 1);
        else if (data.interval === '3 Months') nextBilling.setMonth(start.getMonth() + 3);
        else if (data.interval === '6 Months') nextBilling.setMonth(start.getMonth() + 6);
        else if (data.interval === 'Yearly') nextBilling.setFullYear(start.getFullYear() + 1);
        finalNextBillingDate = nextBilling.toISOString().split('T')[0];
      }

      const { data: newSub, error } = await supabase
        .from('subscriptions')
        .insert([{
          organization_id: orgId,
          client_id: data.client_id,
          amount: data.amount,
          currency: data.currency,
          interval: data.interval,
          start_date: data.start_date,
          next_billing_date: finalNextBillingDate,
          status: 'Inactive'
        }])
        .select()
        .single();
      
      if (error) throw error;
      return newSub;
    },
    onSuccess: () => navigate('/app/subscriptions')
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Create Subscription</h1>

      <form onSubmit={handleSubmit(d => createSubscription.mutate(d))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="space-y-2">
              <Label>Client</Label>
              <select 
                {...register('client_id')} 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a client...</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.client_id && <p className="text-sm text-destructive">{errors.client_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <select 
                  {...register('currency')} 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Billing Interval</Label>
                <select 
                  {...register('interval')} 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="3 Months">Every 3 Months</option>
                  <option value="6 Months">Every 6 Months</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...register('start_date')} />
              </div>
              <div className="space-y-2">
                <Label>Payment Due Date (Optional)</Label>
                <Input type="date" {...register('payment_due_date')} />
                <p className="text-xs text-muted-foreground">Leave blank to calculate automatically.</p>
              </div>
            </div>

          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => navigate('/app/subscriptions')}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Subscription'}</Button>
        </div>
      </form>
    </div>
  );
}
