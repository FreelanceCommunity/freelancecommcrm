import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const { organizationId, clientId } = useAuth();
  
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      // Allow query if it belongs to their org (admin) or their client (portal)
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(name, email, phone, address, country, state),
          items:invoice_items(*)
        `)
        .eq('id', id);

      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-10 text-center">Loading invoice...</div>;
  if (error || !invoice) return <div className="p-10 text-center text-destructive">Invoice not found or access denied.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" asChild>
          <Link to={clientId ? "/portal/invoices" : "/app/invoices"}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>

      <div className="bg-white p-10 border rounded-lg shadow-sm print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start border-b pb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">INVOICE</h1>
            <div className="mt-2 text-slate-600 font-medium">#{invoice.invoice_number}</div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900">Freelancecomm</h2>
            <p className="text-slate-500 mt-1">support@freelancecomm.site</p>
          </div>
        </div>

        <div className="flex justify-between items-start py-8">
          <div>
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Billed To</div>
            <div className="text-slate-900 font-semibold">{invoice.client?.name}</div>
            <div className="text-slate-600 mt-1">{invoice.client?.email}</div>
            {invoice.client?.address && <div className="text-slate-600">{invoice.client?.address}</div>}
            {(invoice.client?.state || invoice.client?.country) && (
              <div className="text-slate-600">{invoice.client?.state} {invoice.client?.country}</div>
            )}
          </div>
          <div className="text-right flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Invoice Date</div>
              <div className="text-slate-900 font-medium">{new Date(invoice.invoice_date).toLocaleDateString()}</div>
            </div>
            {invoice.due_date && (
              <div>
                <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Due Date</div>
                <div className="text-slate-900 font-medium">{new Date(invoice.due_date).toLocaleDateString()}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</div>
              <div className="text-slate-900 font-medium uppercase">{invoice.status}</div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-t border-slate-200">
                <th className="py-3 font-semibold text-slate-600">Description</th>
                <th className="py-3 font-semibold text-slate-600 text-center">Qty</th>
                <th className="py-3 font-semibold text-slate-600 text-right">Price</th>
                <th className="py-3 font-semibold text-slate-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items?.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-4 text-slate-900">{item.description}</td>
                  <td className="py-4 text-slate-600 text-center">{item.quantity}</td>
                  <td className="py-4 text-slate-600 text-right">{invoice.currency === 'INR' ? '₹' : '$'}{item.unit_price}</td>
                  <td className="py-4 text-slate-900 font-medium text-right">{invoice.currency === 'INR' ? '₹' : '$'}{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-64 space-y-3 border-t pt-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{invoice.currency === 'INR' ? '₹' : '$'}{invoice.subtotal}</span>
            </div>
            {invoice.tax > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span>{invoice.currency === 'INR' ? '₹' : '$'}{invoice.tax}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-slate-900 border-t pt-3">
              <span>Total</span>
              <span>{invoice.currency === 'INR' ? '₹' : '$'}{invoice.total}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-green-600 font-medium pt-2">
                <span>Amount Paid</span>
                <span>-{invoice.currency === 'INR' ? '₹' : '$'}{invoice.amount_paid}</span>
              </div>
            )}
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-slate-900 font-bold border-t pt-2">
                <span>Balance Due</span>
                <span>{invoice.currency === 'INR' ? '₹' : '$'}{Math.max(0, invoice.total - invoice.amount_paid).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t text-sm text-slate-500 text-center">
          Thank you for your business. Please make payment by the due date.
        </div>
      </div>
    </div>
  );
}
