import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Search, Plus, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function InvoicesList() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(name)
        `)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const handleSendEmail = async (invoice: any) => {
    setSendingInvoiceId(invoice.id);
    try {
      // Find a contact email (client or primary contact)
      const { data: contacts } = await supabase.from('client_contacts').select('email').eq('client_id', invoice.client_id).eq('is_primary', true).single();
      const { data: client } = await supabase.from('clients').select('email').eq('id', invoice.client_id).single();
      
      const email = contacts?.email || client?.email;
      if (!email) {
        alert('No email found for this client.');
        return;
      }

      const html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Invoice ${invoice.invoice_number} from Freelancecomm</h2>
          <p>Hello,</p>
          <p>Your invoice for <strong>${invoice.currency} ${invoice.total}</strong> from Freelancecomm is ready.</p>
          <p>Due Date: ${invoice.due_date || 'Upon receipt'}</p>
          <p>Status: ${invoice.status}</p>
          <a href="https://crm.freelancecomm.site/portal/invoices" style="display:inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">View Invoice in Portal</a>
        </div>
      `;

      const res = await supabase.functions.invoke('resend-email', {
        body: { to: email, subject: `Invoice ${invoice.invoice_number}`, html }
      });

      if (res.error) throw res.error;
      
      alert('Invoice email sent!');
    } catch (err: any) {
      alert('Failed to send email: ' + err.message);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleSendInChat = async (invoice: any) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0];
      if (!orgId) return;

      const message = `Hello! Your new invoice ${invoice.invoice_number} for ${invoice.currency} ${invoice.total} is ready. You can view it here: https://crm.freelancecomm.site/portal/invoices/${invoice.id}`;
      
      const { error } = await supabase.from('client_messages').insert([{
        organization_id: orgId,
        client_id: invoice.client_id,
        sender_id: userData.user.id,
        message: message
      }]);
      if (error) throw error;
      alert('Invoice sent to client in chat!');
    } catch (err: any) {
      alert('Failed to send in chat: ' + err.message);
    }
  };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleConfirmPayment = async (invoice: any) => {
    try {
      setConfirmingId(invoice.id);
      
      // Update invoice
      const { error: invError } = await supabase
        .from('invoices')
        .update({ status: 'Paid', amount_paid: invoice.total })
        .eq('id', invoice.id);
      if (invError) throw invError;

      // Update related pending payment
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

      alert('Payment confirmed and subscription activated!');
      window.location.reload(); // Simple refresh to update UI
    } catch (err: any) {
      alert('Failed to confirm payment: ' + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <Button asChild>
          <Link to="/app/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="w-full pl-8" />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-4 font-medium">Invoice #</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
              ) : invoices?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FileText className="h-10 w-10 text-muted-foreground/30" />
                      <p>No invoices yet. Create your first invoice to start tracking client billing.</p>
                      <Button variant="outline" asChild>
                        <Link to="/app/invoices/new">Create Invoice</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices?.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">{invoice.invoice_number}</td>
                    <td className="p-4">{invoice.client?.name || 'Unknown Client'}</td>
                    <td className="p-4">{invoice.invoice_date}</td>
                    <td className="p-4 font-medium">{invoice.currency} {invoice.total}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                        {invoice.status}
                      </span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      {invoice.status === 'Pending Confirmation' && (
                        <Button variant="default" size="sm" onClick={() => handleConfirmPayment(invoice)} disabled={confirmingId === invoice.id}>
                          {confirmingId === invoice.id ? 'Confirming...' : 'Confirm Payment'}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleSendEmail(invoice)} disabled={sendingInvoiceId === invoice.id}>
                        {sendingInvoiceId === invoice.id ? 'Emailing...' : 'Email'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleSendInChat(invoice)}>
                        Chat Link
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/invoices/${invoice.id}`}>View</Link>
                      </Button>
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
