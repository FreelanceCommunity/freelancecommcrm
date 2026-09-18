import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Search, Plus, Edit2, FileText, Download, Calendar, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/exportUtils';
import { formatCurrency, CURRENCIES } from '@/lib/currencies';
import { getBillingSettings } from '@/lib/billingSettings';

export default function SubscriptionsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingSub, setEditingSub] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [status, setStatus] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [currency, setCurrency] = useState('USD');
  const [interval, setInterval] = useState('Monthly');
  const [notes, setNotes] = useState('');
  const [generatingSubId, setGeneratingSubId] = useState<string | null>(null);

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          client:clients(id, name, email, address, country, state)
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
          amount: Number(amount),
          currency,
          interval,
          notes,
          start_date: startDate,
          next_billing_date: nextBillingDate || null,
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

  // Generate monthly recurring invoice for this subscription
  const generateMonthlyInvoice = useMutation({
    mutationFn: async (sub: any) => {
      setGeneratingSubId(sub.id);
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0] || sub.organization_id;
      if (!orgId) throw new Error('No organization found');

      // Month name for invoice description
      const now = new Date();
      const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      const invoiceNumber = `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const issueDate = now.toISOString().split('T')[0];
      const dueDateObj = new Date(now.getTime() + 14 * 86400000);
      const dueDate = dueDateObj.toISOString().split('T')[0];

      const settings = getBillingSettings();

      // 1. Create Invoice record
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert([{
          organization_id: orgId,
          client_id: sub.client_id,
          subscription_id: sub.id,
          invoice_number: invoiceNumber,
          invoice_date: issueDate,
          due_date: dueDate,
          currency: sub.currency || settings.defaultCurrency || 'USD',
          subtotal: Number(sub.amount),
          tax_total: 0,
          discount_total: 0,
          total: Number(sub.amount),
          amount_paid: 0,
          status: 'Sent',
          company_name: settings.companyName || 'Freelancecomm',
          company_email: settings.companyEmail || null,
          company_address: settings.companyAddress || null,
          company_phone: settings.companyPhone || null,
          notes: `Monthly recurring subscription billing for ${monthYear}.`,
          terms: settings.defaultPaymentTerms || 'Payment due within 14 days of invoice date.',
          footer_note: settings.defaultFooterNote || `Thank you for choosing ${settings.companyName || 'Freelancecomm'}.`
        }])
        .select()
        .single();

      if (invError) throw invError;

      // 2. Insert line item
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert([{
          invoice_id: invoice.id,
          description: `${sub.interval || 'Monthly'} Subscription Plan - ${monthYear}`,
          quantity: 1,
          unit_price: Number(sub.amount),
          total: Number(sub.amount),
          tax_rate: 0,
          discount: 0
        }]);

      if (itemError) throw itemError;

      // 3. Advance next_billing_date of subscription by 1 month
      const currentNextBilling = sub.next_billing_date ? new Date(sub.next_billing_date) : new Date();
      currentNextBilling.setMonth(currentNextBilling.getMonth() + 1);
      const advancedNextDate = currentNextBilling.toISOString().split('T')[0];

      await supabase
        .from('subscriptions')
        .update({
          next_billing_date: advancedNextDate,
          status: 'Active'
        })
        .eq('id', sub.id);

      return invoice;
    },
    onSuccess: (invoice) => {
      toast({
        title: 'Monthly Invoice Created!',
        description: `Invoice #${invoice.invoice_number} has been generated for ${formatCurrency(invoice.total, invoice.currency)}.`
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      toast({ title: 'Invoice Generation Failed', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setGeneratingSubId(null);
    }
  });

  const openEdit = (sub: any) => {
    setEditingSub(sub);
    setStartDate(sub.start_date || '');
    setNextBillingDate(sub.next_billing_date || '');
    setStatus(sub.status || 'Active');
    setAmount(sub.amount || 0);
    setCurrency(sub.currency || 'USD');
    setInterval(sub.interval || 'Monthly');
    setNotes(sub.notes || '');
  };

  const handleExport = () => {
    if (subscriptions) {
      exportToCSV(subscriptions, 'subscriptions.csv');
    }
  };

  const filteredSubscriptions = subscriptions?.filter((sub) => {
    const matchesSearch =
      sub.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.currency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.interval?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage recurring client subscriptions and generate monthly billing invoices.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client or currency..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {['All', 'Active', 'Trialing', 'Past Due', 'Paused', 'Cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted bg-background border'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Subscription Rate</th>
                <th className="p-4 font-medium">Billing Interval</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Next Billing Date</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : !filteredSubscriptions || filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">
                      <Link to={`/app/clients/${sub.client_id}`} className="hover:underline text-primary">
                        {sub.client?.name || 'Unknown Client'}
                      </Link>
                    </td>
                    <td className="p-4 font-semibold">
                      {formatCurrency(sub.amount, sub.currency)}
                    </td>
                    <td className="p-4 capitalize">
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {sub.interval}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          sub.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : sub.status === 'Past Due'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => generateMonthlyInvoice.mutate(sub)}
                          disabled={generatingSubId === sub.id}
                          title="Generate a monthly subscription invoice and advance billing date"
                        >
                          {generatingSubId === sub.id ? (
                            <>
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              Generate Monthly Invoice
                            </>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(sub)} title="Edit Subscription">
                          <Edit2 className="h-4 w-4" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update subscription pricing, intervals, dates, or status for {editingSub?.client?.name}.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateSub.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Interval</Label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="Yearly">Yearly</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Trialing">Trialing</option>
                  <option value="Past Due">Past Due</option>
                  <option value="Paused">Paused</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Next Billing Date</Label>
                <Input type="date" value={nextBillingDate} onChange={(e) => setNextBillingDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Subscription Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or plan details..."
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setEditingSub(null)}>
                Cancel
              </Button>
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
