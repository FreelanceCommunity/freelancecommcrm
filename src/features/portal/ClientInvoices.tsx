import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, CreditCard, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function ClientInvoices() {
  const { clientId, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['portal_invoices', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const processPayment = useMutation({
    mutationFn: async () => {
      if (!paymentInvoice || !organizationId || !clientId) throw new Error('Missing data');
      
      // Update invoice status to pending confirmation
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ 
          status: 'Pending Confirmation'
        })
        .eq('id', paymentInvoice.id);
        
      if (invoiceError) throw invoiceError;

      // Insert payment record as pending
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          organization_id: organizationId,
          client_id: clientId,
          invoice_id: paymentInvoice.id,
          amount: paymentInvoice.total,
          currency: paymentInvoice.currency || 'USD',
          status: 'Pending',
          payment_method: 'manual'
        }]);

      if (paymentError) throw paymentError;
    },
    onSuccess: () => {
      toast({ title: 'Payment Submitted', description: 'Your payment is pending admin confirmation.' });
      queryClient.invalidateQueries({ queryKey: ['portal_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal_payments'] });
      setPaymentInvoice(null);
    },
    onError: (err: any) => toast({ title: 'Submission Failed', description: err.message, variant: 'destructive' })
  });

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate processing time
    setTimeout(() => {
      processPayment.mutate();
      setIsProcessing(false);
    }, 1000);
  };

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading invoices...</div>;

  const statusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Pending Confirmation': return 'bg-purple-100 text-purple-700';
      case 'Sent': case 'Viewed': return 'bg-blue-100 text-blue-700';
      case 'Overdue': return 'bg-red-100 text-red-700';
      case 'Draft': return 'bg-slate-100 text-slate-600';
      case 'Partially Paid': return 'bg-amber-100 text-amber-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>

      {!invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No invoices yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Invoice #</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Due Date</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                    <th className="p-3 font-medium text-center">Status</th>
                    <th className="p-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{inv.invoice_number}</td>
                      <td className="p-3 text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                      <td className="p-3 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                      <td className="p-3 text-right font-medium">${inv.total}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {inv.status !== 'Paid' && inv.status !== 'Pending Confirmation' && (
                          <Button size="sm" onClick={() => setPaymentInvoice(inv)}>
                            <CreditCard className="h-4 w-4 mr-2" /> Pay Now
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={!!paymentInvoice} onOpenChange={(open) => !open && setPaymentInvoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Secure Payment</DialogTitle>
            <DialogDescription>
              Pay invoice {paymentInvoice?.invoice_number} for <span className="font-bold text-foreground">${paymentInvoice?.total}</span>.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handlePay} className="space-y-4 mt-4">
            <div className="p-4 bg-muted/50 rounded-lg text-sm">
              <p>Please confirm that you want to mark this invoice as paid.</p>
              <p className="mt-2 text-muted-foreground">The admin will verify your manual payment. Once confirmed, your invoice will be marked as Paid and your subscription will be activated.</p>
            </div>

            <div className="pt-4 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setPaymentInvoice(null)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : `Confirm Payment`}
              </Button>
            </div>
            <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1 mt-2">
              <CheckCircle2 className="h-3 w-3" /> Payments are secure and encrypted
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
