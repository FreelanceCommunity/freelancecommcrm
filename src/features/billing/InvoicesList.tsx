import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Search, Plus, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
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
                      <Button variant="outline">Create Invoice</Button>
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
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm">View</Button>
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
