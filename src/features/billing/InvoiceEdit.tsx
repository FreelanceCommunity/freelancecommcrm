/* eslint-disable react/incompatible-library */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, Plus, ArrowLeft, Loader2, Save } from 'lucide-react';
import { CURRENCIES, formatCurrency } from '@/lib/currencies';
import { useToast } from '@/hooks/use-toast';
import { getBillingSettings } from '@/lib/billingSettings';

interface InvoiceItemForm {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

interface InvoiceEditFormData {
  client_id: string;
  subscription_id?: string;
  currency: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  po_number?: string;
  payment_terms: string;
  template: string;
  company_name: string;
  company_email: string;
  company_address: string;
  company_phone: string;
  notes: string;
  terms: string;
  footer_note: string;
  discount: number;
  tax_rate: number;
  shipping: number;
  amount_paid: number;
  items: InvoiceItemForm[];
}

export default function InvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isLoaded, setIsLoaded] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients_lookup_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, email, address, country, state');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: invoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ['invoice_edit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, email, phone, address, country, state),
          items:invoice_items(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { register, control, handleSubmit, watch, reset } = useForm<InvoiceEditFormData>({
    defaultValues: {
      client_id: '',
      currency: 'USD',
      invoice_number: '',
      invoice_date: '',
      due_date: '',
      status: 'Draft',
      payment_terms: 'Due on receipt',
      template: 'modern',
      company_name: '',
      company_email: '',
      company_address: '',
      company_phone: '',
      notes: '',
      terms: '',
      footer_note: '',
      discount: 0,
      tax_rate: 0,
      shipping: 0,
      amount_paid: 0,
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  // When invoice data is loaded, populate form fields
  useEffect(() => {
    if (invoice && !isLoaded) {
      const defaultSettings = getBillingSettings();
      const existingEmail = invoice.company_email === 'billing@freelancecomm.site'
        ? defaultSettings.companyEmail
        : (invoice.company_email || defaultSettings.companyEmail || '');

      const formattedItems: InvoiceItemForm[] = (invoice.items && invoice.items.length > 0)
        ? invoice.items.map((item: any) => ({
            id: item.id,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            tax_rate: Number(item.tax_rate || 0)
          }))
        : [{ description: 'Service', quantity: 1, unit_price: Number(invoice.subtotal || invoice.total || 0) }];

      reset({
        client_id: invoice.client_id || '',
        subscription_id: invoice.subscription_id || undefined,
        currency: invoice.currency || defaultSettings.defaultCurrency || 'USD',
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
        due_date: invoice.due_date || '',
        status: invoice.status || 'Draft',
        po_number: invoice.po_number || '',
        payment_terms: invoice.payment_terms || defaultSettings.defaultPaymentTerms || 'Due on receipt',
        template: invoice.template || 'modern',
        company_name: invoice.company_name || defaultSettings.companyName || 'Freelancecomm',
        company_email: existingEmail,
        company_address: invoice.company_address || defaultSettings.companyAddress || '',
        company_phone: invoice.company_phone || defaultSettings.companyPhone || '',
        notes: invoice.notes || defaultSettings.defaultNotes || '',
        terms: invoice.terms || defaultSettings.defaultPaymentTerms || '',
        footer_note: invoice.footer_note || defaultSettings.defaultFooterNote || `Thank you for choosing ${invoice.company_name || 'Freelancecomm'}.`,
        discount: Number(invoice.discount_total || 0),
        tax_rate: Number(invoice.tax_rate || 0),
        shipping: Number(invoice.shipping || 0),
        amount_paid: Number(invoice.amount_paid || 0),
        items: formattedItems
      });
      setIsLoaded(true);
    }
  }, [invoice, isLoaded, reset]);

  const watchItems = watch('items') || [];
  const watchDiscount = Number(watch('discount') || 0);
  const watchTaxRate = Number(watch('tax_rate') || 0);
  const watchShipping = Number(watch('shipping') || 0);
  const watchAmountPaid = Number(watch('amount_paid') || 0);
  const selectedCurrency = watch('currency') || 'USD';

  const subtotal = watchItems.reduce((acc, item) => {
    return acc + (Number(item.quantity || 0) * Number(item.unit_price || 0));
  }, 0);

  const discountAmount = watchDiscount > 0 ? watchDiscount : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * watchTaxRate) / 100;
  const total = Math.max(0, taxableAmount + taxAmount + watchShipping);
  const balanceDue = Math.max(0, total - watchAmountPaid);

  const updateInvoice = useMutation({
    mutationFn: async (data: InvoiceEditFormData) => {
      if (!id) throw new Error('Invoice ID missing');
      if (!data.client_id) throw new Error('Please select a client');

      const invoicePayload: any = {
        client_id: data.client_id,
        subscription_id: data.subscription_id || null,
        currency: data.currency,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        status: data.status,
        subtotal,
        tax_total: taxAmount,
        discount_total: discountAmount,
        total,
        amount_paid: data.amount_paid,
        notes: data.notes || '',
        terms: data.terms || '',
        template: data.template,
        po_number: data.po_number || null,
        payment_terms: data.payment_terms,
        shipping: watchShipping,
        tax_rate: watchTaxRate,
        company_name: data.company_name,
        company_email: data.company_email || null,
        company_address: data.company_address || null,
        company_phone: data.company_phone || null,
        footer_note: data.footer_note || null,
        updated_at: new Date().toISOString()
      };

      // 1. Update invoice in Supabase (with fallback if footer_note column doesn't exist yet)
      let updateError = null;
      try {
        const { error } = await supabase
          .from('invoices')
          .update(invoicePayload)
          .eq('id', id);
        updateError = error;
      } catch (err: any) {
        updateError = err;
      }

      if (updateError) {
        // Fallback without footer_note
        const { footer_note, ...safePayload } = invoicePayload;
        const { error: fallbackError } = await supabase
          .from('invoices')
          .update(safePayload)
          .eq('id', id);
        if (fallbackError) throw fallbackError;
      }

      // 2. Refresh line items: Delete old items and insert updated items
      await supabase.from('invoice_items').delete().eq('invoice_id', id);

      const itemsToInsert = data.items.map((item) => ({
        invoice_id: id,
        description: item.description || 'Service',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        tax_rate: watchTaxRate,
        discount: 0,
        total: Number(item.quantity || 1) * Number(item.unit_price || 0)
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      toast({ title: 'Invoice Updated', description: 'All changes saved successfully.' });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice_edit', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/app/invoices/${id}`);
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  });

  if (isLoadingInvoice) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p>Loading invoice editor...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-16 text-center">
        <h2 className="text-xl font-bold text-destructive">Invoice not found</h2>
        <p className="text-muted-foreground mt-2">Cannot edit non-existent invoice.</p>
        <Button className="mt-4" onClick={() => navigate('/app/invoices')}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/app/invoices/${id}`)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Cancel & Back to Invoice
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Invoice #{invoice.invoice_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modify invoice line items, pricing, notes, terms, company contact info, or status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/app/invoices/${id}`)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-primary text-primary-foreground flex items-center gap-2"
            disabled={updateInvoice.isPending}
            onClick={handleSubmit((data) => updateInvoice.mutate(data))}
          >
            {updateInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateInvoice.isPending ? 'Saving Changes...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => updateInvoice.mutate(data))} className="space-y-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
            <CardDescription>Primary invoice numbering, client assignment, and status</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <select
                {...register('client_id', { required: true })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a client...</option>
                {(clients || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Number *</Label>
              <Input {...register('invoice_number', { required: true })} />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                {...register('currency')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Issue Date *</Label>
              <Input type="date" {...register('invoice_date', { required: true })} />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" {...register('due_date')} />
            </div>

            <div className="space-y-2">
              <Label>Invoice Status</Label>
              <select
                {...register('status')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Viewed">Viewed</option>
                <option value="Pending Confirmation">Pending Confirmation</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Void">Void</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>PO Number (Optional)</Label>
              <Input {...register('po_number')} placeholder="e.g. PO-8941" />
            </div>

            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Input {...register('payment_terms')} placeholder="e.g. Due on receipt, Net 14" />
            </div>

            <div className="space-y-2">
              <Label>Visual Template</Label>
              <select
                {...register('template')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="modern">Modern (Emerald)</option>
                <option value="classic">Classic (Serif / Slate)</option>
                <option value="minimal">Minimal (Monochrome)</option>
                <option value="corporate">Corporate (Deep Navy)</option>
                <option value="executive">Executive (Dark & Gold)</option>
                <option value="slate">Slate Pro (Tech Neutral)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Company / Sender Information */}
        <Card>
          <CardHeader>
            <CardTitle>Company / Sender Details</CardTitle>
            <CardDescription>Customizable business name, email, phone, and address appearing on this invoice</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input {...register('company_name')} placeholder="Freelancecomm" />
            </div>

            <div className="space-y-2">
              <Label>Company / Support Email</Label>
              <Input
                {...register('company_email')}
                placeholder="e.g. freelancecomm9@gmail.com (leave blank if none)"
              />
              <p className="text-xs text-muted-foreground">
                No forced billing@ email. Enter your actual email or leave empty.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Company Phone</Label>
              <Input {...register('company_phone')} placeholder="+1 (555) 000-0000" />
            </div>

            <div className="space-y-2">
              <Label>Company Address / Headquarters</Label>
              <Input {...register('company_address')} placeholder="City, State, Country" />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Invoice Line Items</CardTitle>
              <CardDescription>Edit descriptions, quantities, and rates</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-xs font-semibold text-muted-foreground uppercase">
                    <th className="pb-3 px-2">Description</th>
                    <th className="pb-3 px-2 w-24 text-center">Qty</th>
                    <th className="pb-3 px-2 w-36 text-right">Unit Rate ({selectedCurrency})</th>
                    <th className="pb-3 px-2 w-36 text-right">Total</th>
                    <th className="pb-3 px-2 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((field, idx) => {
                    const itemQty = Number(watchItems[idx]?.quantity || 0);
                    const itemPrice = Number(watchItems[idx]?.unit_price || 0);
                    const itemLineTotal = itemQty * itemPrice;

                    return (
                      <tr key={field.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-2">
                          <Input
                            {...register(`items.${idx}.description` as const, { required: true })}
                            placeholder="Service or product description"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <Input
                            type="number"
                            step="any"
                            {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })}
                            className="text-center"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <Input
                            type="number"
                            step="any"
                            {...register(`items.${idx}.unit_price` as const, { valueAsNumber: true })}
                            className="text-right"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-sm">
                          {formatCurrency(itemLineTotal, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-8 w-8 hover:bg-destructive/10"
                              onClick={() => remove(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations & Adjustments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice Notes (Customer Visible)</Label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-sm"
                    placeholder="Monthly recurring subscription billing for September 2026..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Terms & Policies</Label>
                  <textarea
                    {...register('terms')}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-sm"
                    placeholder="Payment due within 14 days of invoice date."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Custom Footer Note</Label>
                  <Input
                    {...register('footer_note')}
                    placeholder="Thank you for choosing Freelancecomm. For inquiries, contact us directly."
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize or clear this message to remove any unwanted contact info.
                  </p>
                </div>
              </div>

              <div className="bg-muted/40 p-5 rounded-lg space-y-3">
                <h3 className="font-bold text-sm text-foreground">Summary & Adjustments</h3>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(subtotal, selectedCurrency)}</span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Discount ({selectedCurrency})</span>
                  <Input
                    type="number"
                    step="any"
                    {...register('discount', { valueAsNumber: true })}
                    className="w-32 h-8 text-right text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Tax Rate (%)</span>
                  <Input
                    type="number"
                    step="any"
                    {...register('tax_rate', { valueAsNumber: true })}
                    className="w-32 h-8 text-right text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Shipping Fee ({selectedCurrency})</span>
                  <Input
                    type="number"
                    step="any"
                    {...register('shipping', { valueAsNumber: true })}
                    className="w-32 h-8 text-right text-xs"
                  />
                </div>

                <div className="border-t pt-2 flex justify-between text-base font-bold text-foreground">
                  <span>Total Amount</span>
                  <span className="text-primary">{formatCurrency(total, selectedCurrency)}</span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm pt-1">
                  <span className="text-muted-foreground">Amount Already Paid</span>
                  <Input
                    type="number"
                    step="any"
                    {...register('amount_paid', { valueAsNumber: true })}
                    className="w-32 h-8 text-right text-xs text-emerald-600 font-semibold"
                  />
                </div>

                <div className="border-t pt-2 flex justify-between text-sm font-bold bg-background p-2.5 rounded">
                  <span>Balance Due</span>
                  <span className={balanceDue > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                    {formatCurrency(balanceDue, selectedCurrency)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(`/app/invoices/${id}`)}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-primary text-primary-foreground min-w-36 flex items-center gap-2"
            disabled={updateInvoice.isPending}
          >
            {updateInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateInvoice.isPending ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
