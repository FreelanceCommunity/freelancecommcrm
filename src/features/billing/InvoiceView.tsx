import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Printer, ArrowLeft, Download, Mail, MessageSquare, CheckCircle2, 
  FileText, Calendar, Building2, User, CreditCard, Sparkles, Trash2, Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencies';
import { useToast } from '@/hooks/use-toast';

type TemplateType = 'modern' | 'classic' | 'minimal' | 'corporate' | 'executive' | 'slate';

const TEMPLATES: { id: TemplateType; name: string; summary: string; color: string }[] = [
  { id: 'modern', name: 'Modern', summary: 'Clean layout with green accents and bold structure', color: '#10b981' },
  { id: 'classic', name: 'Classic', summary: 'Serif header and traditional corporate layout', color: '#475569' },
  { id: 'minimal', name: 'Minimal', summary: 'Ultra-clean lightweight monochrome presentation', color: '#0f172a' },
  { id: 'corporate', name: 'Corporate', summary: 'Financial deep navy banner and structured tables', color: '#1d4ed8' },
  { id: 'executive', name: 'Executive', summary: 'Dark header band with sleek gold accents', color: '#d97706' },
  { id: 'slate', name: 'Slate Pro', summary: 'Modern SaaS tech palette with neutral tones', color: '#334155' },
];

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const { organizationId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('modern');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, email, phone, address, country, state),
          subscription:subscriptions(id, interval, plan_id),
          items:invoice_items(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Mark invoice as paid
  const markAsPaid = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      const { error: invError } = await supabase
        .from('invoices')
        .update({
          status: 'Paid',
          amount_paid: invoice.total
        })
        .eq('id', invoice.id);
      if (invError) throw invError;

      // Also record payment
      await supabase.from('payments').insert([{
        organization_id: invoice.organization_id || organizationId,
        client_id: invoice.client_id,
        invoice_id: invoice.id,
        amount: invoice.total,
        currency: invoice.currency || 'USD',
        status: 'Succeeded',
        payment_method: 'manual'
      }]);

      // If linked to subscription, keep it active
      if (invoice.subscription_id) {
        await supabase
          .from('subscriptions')
          .update({ status: 'Active' })
          .eq('id', invoice.subscription_id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Payment Confirmed', description: 'Invoice marked as Paid.' });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const deleteInvoice = useMutation({
    mutationFn: async () => {
      if (!confirm('Are you sure you want to delete this invoice?')) return;
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Invoice Deleted', description: 'The invoice has been removed.' });
      navigate('/app/invoices');
    }
  });

  const handleSendEmail = async () => {
    if (!invoice) return;
    setIsSendingEmail(true);
    try {
      const email = invoice.client?.email;
      if (!email) {
        toast({ title: 'No Email Found', description: 'Client has no email address configured.', variant: 'destructive' });
        return;
      }

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Invoice ${invoice.invoice_number}</h2>
          <p style="color: #475569;">Hello ${invoice.client?.name || 'Customer'},</p>
          <p style="color: #475569;">Your invoice for <strong>${formatCurrency(invoice.total, invoice.currency)}</strong> from Freelancecomm is ready.</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #334155;"><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
            <p style="margin: 4px 0; color: #334155;"><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon receipt'}</p>
            <p style="margin: 4px 0; color: #334155;"><strong>Status:</strong> ${invoice.status}</p>
            <p style="margin: 4px 0; color: #334155;"><strong>Total Amount:</strong> ${formatCurrency(invoice.total, invoice.currency)}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">Thank you for your business! Please contact billing@freelancecomm.site for any inquiries.</p>
        </div>
      `;

      const res = await supabase.functions.invoke('resend-email', {
        body: { to: email, subject: `Invoice ${invoice.invoice_number} from Freelancecomm`, html }
      });

      if (res.error) throw res.error;
      toast({ title: 'Email Sent', description: `Invoice sent to ${email}.` });
    } catch (err: any) {
      toast({ title: 'Email Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendChat = async () => {
    if (!invoice) return;
    setIsSendingChat(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const orgId = organizationId || invoice.organization_id;

      const messageText = `Hello! Invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total, invoice.currency)} has been generated. Due date: ${invoice.due_date || 'Due upon receipt'}. Status: ${invoice.status}.`;
      
      const { error } = await supabase.from('client_messages').insert([{
        organization_id: orgId,
        client_id: invoice.client_id,
        sender_id: userData.user.id,
        message: messageText
      }]);

      if (error) throw error;
      toast({ title: 'Sent to Chat', description: 'Invoice notification posted in client chat.' });
    } catch (err: any) {
      toast({ title: 'Chat Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingChat(false);
    }
  };

  const downloadCSV = () => {
    if (!invoice) return;
    const headers = ['Item Description', 'Quantity', 'Unit Rate', 'Total'];
    const rows = (invoice.items || []).map((item: any) => [
      `"${(item.description || '').replace(/"/g, '""')}"`,
      item.quantity || 1,
      item.unit_price || 0,
      item.total || 0
    ]);

    rows.push(['', '', 'Subtotal', invoice.subtotal]);
    if (invoice.discount_total) rows.push(['', '', 'Discount', -invoice.discount_total]);
    if (invoice.tax_total) rows.push(['', '', 'Tax', invoice.tax_total]);
    rows.push(['', '', 'Total', invoice.total]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${invoice.invoice_number}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = () => {
    if (!invoice) return;
    const blob = new Blob([JSON.stringify(invoice, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${invoice.invoice_number}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p>Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-16 text-center">
        <h2 className="text-xl font-bold text-destructive">Invoice not found</h2>
        <p className="text-muted-foreground mt-2">The requested invoice could not be loaded.</p>
        <Button className="mt-4" asChild>
          <Link to="/app/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const currency = invoice.currency || 'USD';
  const balanceDue = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));

  // Template styling classes
  const templateConfig = {
    modern: {
      headerBg: 'bg-emerald-600 text-white',
      accentColor: 'text-emerald-600',
      borderAccent: 'border-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tableHeader: 'bg-slate-50 text-slate-700'
    },
    classic: {
      headerBg: 'bg-slate-800 text-white font-serif',
      accentColor: 'text-slate-800',
      borderAccent: 'border-slate-400',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      tableHeader: 'bg-slate-100 text-slate-800 font-serif'
    },
    minimal: {
      headerBg: 'bg-white text-slate-900 border-b-2 border-black',
      accentColor: 'text-black',
      borderAccent: 'border-black',
      badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300',
      tableHeader: 'bg-neutral-50 text-neutral-900'
    },
    corporate: {
      headerBg: 'bg-blue-700 text-white',
      accentColor: 'text-blue-700',
      borderAccent: 'border-blue-600',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      tableHeader: 'bg-blue-50 text-blue-900'
    },
    executive: {
      headerBg: 'bg-neutral-900 text-amber-400 border-b-2 border-amber-500',
      accentColor: 'text-amber-600',
      borderAccent: 'border-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      tableHeader: 'bg-neutral-100 text-neutral-900'
    },
    slate: {
      headerBg: 'bg-slate-700 text-white',
      accentColor: 'text-slate-700',
      borderAccent: 'border-slate-500',
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      tableHeader: 'bg-slate-100 text-slate-800'
    }
  }[selectedTemplate];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between print:hidden">
        <Button variant="outline" asChild>
          <Link to="/app/invoices">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
          </Link>
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== 'Paid' && (
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => markAsPaid.mutate()}
              disabled={markAsPaid.isPending}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {markAsPaid.isPending ? 'Marking Paid...' : 'Mark as Paid'}
            </Button>
          )}

          <Button variant="outline" onClick={() => window.print()} title="Print or Save PDF">
            <Printer className="mr-1.5 h-4 w-4" /> Print / PDF
          </Button>

          <Button variant="outline" onClick={handleSendEmail} disabled={isSendingEmail} title="Email PDF details to client">
            <Mail className="mr-1.5 h-4 w-4" /> {isSendingEmail ? 'Sending...' : 'Email'}
          </Button>

          <Button variant="outline" onClick={handleSendChat} disabled={isSendingChat} title="Send link in CRM chat">
            <MessageSquare className="mr-1.5 h-4 w-4" /> {isSendingChat ? 'Sending...' : 'Chat Link'}
          </Button>

          <Button variant="outline" onClick={downloadCSV} title="Export CSV">
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>

          <Button variant="outline" onClick={downloadJSON} title="Export JSON">
            <FileText className="mr-1.5 h-4 w-4" /> JSON
          </Button>

          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteInvoice.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Template Switcher Bar */}
      <div className="bg-card border rounded-lg p-3 flex items-center gap-2 overflow-x-auto print:hidden">
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap px-2 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Invoice Template:
        </span>
        <div className="flex gap-1.5">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedTemplate === tmpl.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tmpl.color }} />
              {tmpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Actual Printable Invoice Container */}
      <div
        id="invoice-printable"
        className="bg-white text-slate-900 border rounded-xl shadow-md p-8 md:p-12 print:shadow-none print:border-none print:p-0 transition-all"
        style={{ minHeight: '850px' }}
      >
        {/* Template Header Banner */}
        <div className={`p-6 rounded-lg mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${templateConfig.headerBg}`}>
          <div>
            <span className="text-xs font-bold tracking-widest uppercase opacity-80 block">TAX INVOICE</span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-1">#{invoice.invoice_number}</h1>
            {invoice.subscription_id && (
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-white">
                <CreditCard className="h-3.5 w-3.5" />
                Monthly Subscription Invoice
              </span>
            )}
          </div>
          <div className="text-left md:text-right">
            <h2 className="text-xl font-bold">{invoice.company_name || 'Freelancecomm'}</h2>
            <p className="text-xs opacity-90">{invoice.company_email || 'billing@freelancecomm.site'}</p>
            {invoice.company_phone && <p className="text-xs opacity-80">{invoice.company_phone}</p>}
            {invoice.company_address && <p className="text-xs opacity-80">{invoice.company_address}</p>}
          </div>
        </div>

        {/* Invoice Meta Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 border-b border-slate-200">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Billed To</span>
            <h3 className="text-base font-bold text-slate-900">{invoice.client?.name || 'Valued Client'}</h3>
            {invoice.client?.email && <p className="text-xs text-slate-600 mt-0.5">{invoice.client?.email}</p>}
            {invoice.client?.address && <p className="text-xs text-slate-600">{invoice.client?.address}</p>}
            {(invoice.client?.state || invoice.client?.country) && (
              <p className="text-xs text-slate-600">{invoice.client?.state} {invoice.client?.country}</p>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Invoice Date</span>
              <span className="text-sm font-semibold text-slate-800">
                {new Date(invoice.invoice_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Due Date</span>
              <span className="text-sm font-semibold text-slate-800">
                {invoice.due_date
                  ? new Date(invoice.due_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Due on receipt'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-left md:text-right">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Status</span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-1 ${
                  invoice.status === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : invoice.status === 'Overdue'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {invoice.status}
              </span>
            </div>
            {invoice.po_number && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">PO Number</span>
                <span className="text-xs font-medium text-slate-700">{invoice.po_number}</span>
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Currency</span>
              <span className="text-xs font-semibold text-slate-700">{currency}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b-2 border-slate-300 text-xs font-bold uppercase tracking-wider ${templateConfig.tableHeader}`}>
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4 text-center w-24">Qty</th>
                <th className="py-3 px-4 text-right w-36">Rate ({currency})</th>
                <th className="py-3 px-4 text-right w-36">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {(invoice.items || []).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-4 font-medium text-slate-800">{item.description}</td>
                  <td className="py-4 px-4 text-center text-slate-600">{item.quantity}</td>
                  <td className="py-4 px-4 text-right text-slate-600">{formatCurrency(item.unit_price, currency)}</td>
                  <td className="py-4 px-4 text-right font-semibold text-slate-900">
                    {formatCurrency(item.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary & Totals Calculation */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col md:flex-row justify-between gap-8">
          <div className="flex-1 space-y-4">
            {invoice.notes && (
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes</span>
                <p className="text-xs text-slate-600 whitespace-pre-line bg-slate-50 p-3 rounded border border-slate-100">
                  {invoice.notes}
                </p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Terms</span>
                <p className="text-xs text-slate-500 whitespace-pre-line">{invoice.terms}</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-80 space-y-2.5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal, currency)}</span>
            </div>

            {Number(invoice.discount_total || 0) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discount_total, currency)}</span>
              </div>
            )}

            {Number(invoice.tax_total || 0) > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax</span>
                <span>+{formatCurrency(invoice.tax_total, currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold text-slate-900 border-t-2 border-slate-300 pt-2.5">
              <span>Total Amount</span>
              <span className={templateConfig.accentColor}>{formatCurrency(invoice.total, currency)}</span>
            </div>

            {Number(invoice.amount_paid || 0) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 pt-1">
                <span>Amount Paid</span>
                <span>-{formatCurrency(invoice.amount_paid, currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2 bg-slate-50 p-2.5 rounded">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                {formatCurrency(balanceDue, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-16 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          Thank you for choosing Freelancecomm. For billing support, email{' '}
          <a href="mailto:billing@freelancecomm.site" className="text-primary hover:underline">
            billing@freelancecomm.site
          </a>
        </div>
      </div>
    </div>
  );
}
