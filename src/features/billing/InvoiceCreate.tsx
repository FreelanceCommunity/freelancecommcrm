import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.number().min(1),
  unit_price: z.number().min(0)
});

const invoiceSchema = z.object({
  client_id: z.string().min(1, "Client is required"),
  currency: z.enum(['USD', 'INR']),
  invoice_date: z.string(),
  due_date: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required")
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export default function InvoiceCreate() {
  const navigate = useNavigate();
  
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name');
      if (error) throw error;
      return data;
    }
  });

  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      currency: 'USD',
      invoice_date: new Date().toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchItems = watch('items');
  const subtotal = useMemo(() => watchItems.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unit_price || 0)), 0), [watchItems]);
  const total = subtotal; // Ignoring tax/discount for simplicity in this demo.

  const createInvoice = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0];
      if (!orgId) throw new Error("No organization found");

      // Generate invoice number
      const invoice_number = `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      // Insert invoice
      const { data: newInvoice, error: invError } = await supabase
        .from('invoices')
        .insert([{
          organization_id: orgId,
          client_id: data.client_id,
          currency: data.currency,
          invoice_number,
          invoice_date: data.invoice_date,
          due_date: data.due_date || null,
          subtotal,
          total,
          status: 'Draft'
        }])
        .select()
        .single();
      
      if (invError) throw invError;

      // Insert items
      const itemsToInsert = data.items.map(item => ({
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      return newInvoice;
    },
    onSuccess: () => {
      navigate('/app/invoices');
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>

      <form onSubmit={handleSubmit((d) => createInvoice.mutate(d))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <select 
                {...register('client_id')} 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a client...</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.client_id && <p className="text-sm text-destructive">{errors.client_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <select 
                {...register('currency')} 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" {...register('invoice_date')} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" {...register('due_date')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label className={index !== 0 ? 'sr-only' : ''}>Description</Label>
                    <Input {...register(`items.${index}.description` as const)} placeholder="Item description" />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label className={index !== 0 ? 'sr-only' : ''}>Qty</Label>
                    <Input type="number" step="0.01" {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label className={index !== 0 ? 'sr-only' : ''}>Price</Label>
                    <Input type="number" step="0.01" {...register(`items.${index}.unit_price` as const, { valueAsNumber: true })} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>

            <div className="flex justify-end pt-4 border-t">
              <div className="w-64 space-y-2">
                <div className="flex justify-between font-medium text-lg">
                  <span>Total</span>
                  <span>{watch('currency') === 'INR' ? '₹' : '$'}{subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => navigate('/app/invoices')}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Draft'}</Button>
        </div>
      </form>
    </div>
  );
}
