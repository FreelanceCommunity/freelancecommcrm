import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { 
  Search, Plus, FileText, Download, Mail, MessageSquare, CheckCircle2, 
  Trash2, CreditCard, Sparkles, Clock, AlertCircle, Loader2 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/currencies';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';

export default function InvoicesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(name, email),
          subscription:subscriptions(interval, status)
        `)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Batch generate monthly invoices for all active subscriptions
  const handleBatchGenerateSubscriptions = async () => {
    try {
      setIsBatchGenerating(true);
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0];
      if (!orgId) throw new Error('No organization found');

      // 1. Fetch active subscriptions
      const { data: activeSubs, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'Active');

      if (subsError) throw subsError;
      if (!activeSubs || activeSubs.length === 0) {
        toast({ title: 'No Subscriptions', description: 'No active subscriptions to bill.' });
        return;
      }

      const now = new Date();
      const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      const issueDate = now.toISOString().split('T')[0];
      const dueDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      let generatedCount = 0;

      for (const sub of activeSubs) {
        const invoiceNumber = `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: newInv, error: invError } = await supabase
          .from('invoices')
          .insert([{
            organization_id: orgId,
            client_id: sub.client_id,
            subscription_id: sub.id,
            invoice_number: invoiceNumber,
            invoice_date: issueDate,
            due_date: dueDate,
            currency: sub.currency || 'USD',
            subtotal: Number(sub.amount),
            total: Number(sub.amount),
            amount_paid: 0,
            status: 'Sent',
            notes: `Monthly recurring subscription billing for ${monthYear}.`
          }])
          .select()
          .single();

        if (!invError && newInv) {
          generatedCount++;
          await supabase.from('invoice_items').insert([{
            invoice_id: newInv.id,
            description: `${sub.interval || 'Monthly'} Subscription Plan - ${monthYear}`,
            quantity: 1,
            unit_price: Number(sub.amount),
            total: Number(sub.amount)
          }]);

          // Advance next billing date
          const currentNext = sub.next_billing_date ? new Date(sub.next_billing_date) : new Date();
          currentNext.setMonth(currentNext.getMonth() + 1);
          await supabase
            .from('subscriptions')
            .update({ next_billing_date: currentNext.toISOString().split('T')[0] })
            .eq('id', sub.id);
        }
      }

      toast({
        title: 'Batch Generation Complete!',
        description: `Generated ${generatedCount} monthly subscription invoices.`
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    } catch (err: any) {
      toast({ title: 'Batch Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const handleSendEmail = async (invoice: any) => {
    setSendingInvoiceId(invoice.id);
    try {
      const email = invoice.client?.email;
      if (!email) {
        toast({ title: 'Missing Email', description: 'No email found for this client.', variant: 'destructive' });
        return;
      }

      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2>Invoice ${invoice.invoice_number} from Freelancecomm</h2>
          <p>Hello,</p>
          <p>Your invoice for <strong>${formatCurrency(invoice.total, invoice.currency)}</strong> from Freelancecomm is ready.</p>
          <p>Due Date: ${invoice.due_date || 'Upon receipt'}</p>
          <p>Status: ${invoice.status}</p>
          <p>Thank you for your business!</p>
        </div>
      `;

      const res = await supabase.functions.invoke('resend-email', {
        body: { to: email, subject: `Invoice ${invoice.invoice_number}`, html }
      });

      if (res.error) throw res.error;
      toast({ title: 'Invoice Sent', description: `Email delivered to ${email}.` });
    } catch (err: any) {
      toast({ title: 'Failed to Send Email', description: err.message, variant: 'destructive' });
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleSendInChat = async (invoice: any) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0] || invoice.organization_id;

      const message = `Hello! Your new invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total, invoice.currency)} has been generated. Due date: ${invoice.due_date || 'Upon receipt'}.`;
      
      const { error } = await supabase.from('client_messages').insert([{
        organization_id: orgId,
        client_id: invoice.client_id,
        sender_id: userData.user.id,
        message
      }]);
      if (error) throw error;
      toast({ title: 'Sent to Chat', description: 'Invoice notification posted in client chat.' });
    } catch (err: any) {
      toast({ title: 'Chat Link Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleConfirmPayment = async (invoice: any) => {
    try {
      setConfirmingId(invoice.id);
      
      const { error: invError } = await supabase
        .from('invoices')
        .update({ status: 'Paid', amount_paid: invoice.total })
        .eq('id', invoice.id);
      if (invError) throw invError;

      await supabase
        .from('payments')
        .update({ status: 'Succeeded' })
        .eq('invoice_id', invoice.id);

      // Activate any past due subscriptions for this client
      await supabase
        .from('subscriptions')
        .update({ status: 'Active' })
        .eq('client_id', invoice.client_id)
        .in('status', ['Past Due', 'Pending', 'Canceled']);

      toast({ title: 'Payment Confirmed', description: 'Invoice marked as Paid.' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast({ title: 'Failed to Confirm Payment', description: err.message, variant: 'destructive' });
    } finally {
      setConfirmingId(null);
    }
  };

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Are you sure you want to delete this invoice?')) return;
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Invoice Deleted', description: 'Invoice removed successfully.' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });

  const handleExport = () => {
    if (invoices) {
      exportToCSV(invoices, 'invoices.csv');
    }
  };

  // Metrics summary
  const totalInvoicedCount = invoices?.length || 0;
  const paidCount = invoices?.filter((i) => i.status === 'Paid').length || 0;
  const pendingCount = invoices?.filter((i) => i.status === 'Pending Confirmation').length || 0;
  const overdueCount = invoices?.filter((i) => i.status === 'Overdue').length || 0;

  const filteredInvoices = invoices?.filter((inv) => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.currency?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Admin billing dashboard: multi-currency invoicing, monthly subscription generation, and tracking.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-300"
            onClick={handleBatchGenerateSubscriptions}
            disabled={isBatchGenerating}
            title="Generate monthly invoices for all active client subscriptions"
          >
            {isBatchGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4 text-emerald-600" />
                Generate Subscription Invoices
              </>
            )}
          </Button>

          <Button variant="outline" onClick={handleExport} disabled={!invoices || invoices.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>

          <Button asChild>
            <Link to="/app/invoices/new">
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Invoices</span>
            <FileText className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold mt-1">{totalInvoicedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-emerald-600">
            <span>Paid Invoices</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{paidCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-purple-600">
            <span>Pending Confirmation</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{pendingCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-rose-600">
            <span>Overdue Invoices</span>
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{overdueCount}</div>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices by #, client, currency..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {['All', 'Draft', 'Sent', 'Pending Confirmation', 'Paid', 'Overdue'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted bg-background border'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-md border bg-card">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-4 font-medium">Invoice #</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Total Amount</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading invoices...
                  </td>
                </tr>
              ) : !filteredInvoices || filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FileText className="h-10 w-10 text-muted-foreground/30" />
                      <p>No invoices match your current filter.</p>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/app/invoices/new">Create Invoice</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium font-mono text-xs">
                      <Link to={`/app/invoices/${invoice.id}`} className="hover:underline text-primary">
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="p-4">
                      <span className="font-medium">{invoice.client?.name || 'Unknown Client'}</span>
                      {invoice.client?.email && (
                        <span className="block text-xs text-muted-foreground">{invoice.client.email}</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-semibold">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </td>
                    <td className="p-4">
                      {invoice.subscription_id ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
                          <CreditCard className="h-3 w-3" />
                          Subscription
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Standard</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          invoice.status === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : invoice.status === 'Pending Confirmation'
                            ? 'bg-purple-500/10 text-purple-600'
                            : invoice.status === 'Overdue'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {invoice.status === 'Pending Confirmation' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleConfirmPayment(invoice)}
                            disabled={confirmingId === invoice.id}
                          >
                            {confirmingId === invoice.id ? 'Confirming...' : 'Confirm Paid'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleSendEmail(invoice)}
                          disabled={sendingInvoiceId === invoice.id}
                          title="Send email"
                        >
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          {sendingInvoiceId === invoice.id ? '...' : 'Email'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleSendInChat(invoice)}
                          title="Send to chat"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <Link to={`/app/invoices/${invoice.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteInvoice.mutate(invoice.id)}
                          title="Delete invoice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  );
}
