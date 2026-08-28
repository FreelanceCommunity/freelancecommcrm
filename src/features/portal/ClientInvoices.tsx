import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function ClientInvoices() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['portal_invoices_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p>Loading invoices...</p>
          ) : invoices?.length === 0 ? (
            <p className="text-muted-foreground">You have no invoices.</p>
          ) : (
            <div className="divide-y">
              {invoices?.map(inv => (
                <div key={inv.id} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-lg">{inv.invoice_number}</div>
                    <div className="text-sm text-muted-foreground">Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">${inv.total}</div>
                      <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full font-semibold">{inv.status}</span>
                    </div>
                    {inv.status !== 'Paid' && (
                      <Button size="sm">Pay Now</Button>
                    )}
                    <Button variant="outline" size="sm" title="Download PDF">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
