/* eslint-disable react/incompatible-library */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, Plus, Sparkles, Building2, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import { CURRENCIES, formatCurrency } from '@/lib/currencies';
import { useToast } from '@/hooks/use-toast';
import { getBillingSettings } from '@/lib/billingSettings';

interface InvoiceItemForm {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

interface InvoiceFormData {
  client_id: string;
  subscription_id?: string;
  currency: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  po_number?: string;
  payment_terms: string;
  template: string;
  company_name: string;
  company_email: string;
  company_address: string;
  company_phone: string;
  notes: string;
  terms: string;
  footer_note?: string;
  discount: number;
  tax_rate: number;
  shipping: number;
  items: InvoiceItemForm[];
}

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dueStr = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
  const defaultInvNum = `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: clients } = useQuery({
    queryKey: ['clients_lookup_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, email, address, country, state');
      if (error) throw error;
      return data || [];
    }
  });

  const billingDefaults = getBillingSettings();

  const { register, control, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<InvoiceFormData>({
    defaultValues: {
      currency: billingDefaults.defaultCurrency || 'USD',
      invoice_number: defaultInvNum,
      invoice_date: todayStr,
      due_date: dueStr,
      payment_terms: billingDefaults.defaultPaymentTerms || 'Due on receipt',
      template: 'modern',
      company_name: billingDefaults.companyName || 'Freelancecomm',
      company_email: billingDefaults.companyEmail || '',
      company_address: billingDefaults.companyAddress || '',
      company_phone: billingDefaults.companyPhone || '',
      notes: billingDefaults.defaultNotes || 'Thank you for your business. Please remit payment by the due date.',
      terms: billingDefaults.defaultPaymentTerms || 'Payment is due within 14 days of invoice issue.',
      footer_note: billingDefaults.defaultFooterNote || `Thank you for choosing ${billingDefaults.companyName || 'Freelancecomm'}.`,
      discount: 0,
      tax_rate: 0,
      shipping: 0,
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const selectedClientId = watch('client_id');
  const selectedCurrency = watch('currency');

  // Fetch client subscriptions if a client is selected
  const { data: clientSubscriptions } = useQuery({
    queryKey: ['client_subscriptions_lookup', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('client_id', selectedClientId)
        .eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId
  });

  // When client changes, auto-fill address if available
  useEffect(() => {
    if (selectedClientId && clients) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client) {
        // Reset selected subscription
        setSelectedSubId('');
      }
    }
  }, [selectedClientId, clients]);

  // Handle auto-fill from subscription
  const handleSelectSubscription = (subId: string) => {
    setSelectedSubId(subId);
    if (!subId) return;

    const sub = clientSubscriptions?.find((s) => s.id === subId);
    if (sub) {
      const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      setValue('subscription_id', sub.id);
      setValue('currency', sub.currency || 'USD');
      setValue('items', [
        {
          description: `${sub.interval || 'Monthly'} Subscription Plan - ${currentMonthYear}`,
          quantity: 1,
          unit_price: Number(sub.amount)
        }
      ]);
      setValue('notes', `Monthly recurring subscription billing for ${currentMonthYear}. Next billing on ${sub.next_billing_date || 'next month'}.`);
      toast({
        title: 'Subscription Selected',
        description: `Auto-populated invoice for ${sub.interval} subscription (${formatCurrency(sub.amount, sub.currency)}).`
      });
    }
  };

  const watchItems = watch('items') || [];
  const watchDiscount = Number(watch('discount') || 0);
  const watchTaxRate = Number(watch('tax_rate') || 0);
  const watchShipping = Number(watch('shipping') || 0);

  const subtotal = watchItems.reduce((acc, item) => {
    return acc + (Number(item.quantity || 0) * Number(item.unit_price || 0));
  }, 0);

  const discountAmount = watchDiscount > 0 ? watchDiscount : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * watchTaxRate) / 100;
  const total = Math.max(0, taxableAmount + taxAmount + watchShipping);

  const createInvoice = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      const orgId = orgs?.[0];
      if (!orgId) throw new Error('No organization found');
      if (!data.client_id) throw new Error('Please select a client');

      // 1. Insert invoice payload (handling standard + optional columns)
      const invoicePayload: any = {
        organization_id: orgId,
        client_id: data.client_id,
        subscription_id: data.subscription_id || null,
        currency: data.currency,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        subtotal,
        tax_total: taxAmount,
        discount_total: discountAmount,
        total,
        status: 'Draft',
        notes: data.notes || '',
        terms: data.terms || ''
      };

      // Try inserting with extended fields, fall back to core fields if schema lacks them
      let newInvoice: any = null;
      try {
        const { data: inv, error: err } = await supabase
          .from('invoices')
          .insert([{
            ...invoicePayload,
            template: data.template,
            po_number: data.po_number || null,
            payment_terms: data.payment_terms,
            shipping: watchShipping,
            tax_rate: watchTaxRate,
            company_name: data.company_name,
            company_email: data.company_email || null,
            company_address: data.company_address || null,
            company_phone: data.company_phone || null,
            footer_note: data.footer_note || null
          }])
          .select()
          .single();

        if (err) throw err;
        newInvoice = inv;
      } catch (extendedErr) {
        // Fallback without extended fields
        const { data: inv, error: fallbackErr } = await supabase
          .from('invoices')
          .insert([invoicePayload])
          .select()
          .single();

        if (fallbackErr) throw fallbackErr;
        newInvoice = inv;
      }

      // 2. Insert line items
      const itemsToInsert = data.items.map((item) => ({
        invoice_id: newInvoice.id,
        description: item.description || 'Service',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        tax_rate: watchTaxRate,
        discount: 0,
        total: Number(item.quantity || 1) * Number(item.unit_price || 0)
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      return newInvoice;
    },
    onSuccess: (newInv) => {
      toast({ title: 'Invoice Created', description: `Invoice #${newInv.invoice_number} saved as draft.` });
      navigate(`/app/invoices/${newInv.id}`);
    },
    onError: (err: any) => {
      toast({ title: 'Error Creating Invoice', description: err.message, variant: 'destructive' });
    }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/invoices')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create Professional Invoice</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build a clean invoice with multi-currency support, subscription linking, and PDF templates.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => createInvoice.mutate(d))} className="space-y-6">
        {/* Subscription Auto-Fill Bar */}
        <Card className="border-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base font-semibold text-indigo-950 dark:text-indigo-200">
                Monthly Subscription Auto-Fill
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Select a client with an active subscription to automatically populate recurring monthly rate, period, and currency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">1. Select Client *</Label>
                <select
                  {...register('client_id', { required: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a client...</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">2. Active Monthly Subscription (Optional)</Label>
                <select
                  value={selectedSubId}
                  onChange={(e) => handleSelectSubscription(e.target.value)}
                  disabled={!clientSubscriptions || clientSubscriptions.length === 0}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">
                    {!selectedClientId
                      ? 'Select a client first'
                      : clientSubscriptions && clientSubscriptions.length > 0
                      ? 'Choose subscription to auto-fill...'
                      : 'No active subscriptions found for this client'}
                  </option>
                  {clientSubscriptions?.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.interval} Plan: {formatCurrency(sub.amount, sub.currency)} (Next: {sub.next_billing_date || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Header Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company & Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Company Name</Label>
                <Input {...register('company_name')} placeholder="Your company name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input {...register('company_email')} placeholder="support@yourcompany.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input {...register('company_phone')} placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input {...register('company_address')} placeholder="123 Business Way, Suite 100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Invoice Settings & Currency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Currency (All Supported)</Label>
                  <select
                    {...register('currency')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Template</Label>
                  <select
                    {...register('template')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  >
                    <option value="modern">Modern (Emerald Accent)</option>
                    <option value="classic">Classic (Serif Formal)</option>
                    <option value="minimal">Minimal (Clean Monochrome)</option>
                    <option value="corporate">Corporate (Financial Navy)</option>
                    <option value="executive">Executive (Dark Band & Gold)</option>
                    <option value="slate">Slate Pro (Tech Minimal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice Number</Label>
                  <Input {...register('invoice_number')} placeholder="INV-2026-001" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Number (Optional)</Label>
                  <Input {...register('po_number')} placeholder="PO-9872" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Issue Date</Label>
                  <Input type="date" {...register('invoice_date')} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" {...register('due_date')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Terms</Label>
                  <select
                    {...register('payment_terms')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-xs"
                  >
                    <option value="Due on receipt">Due on receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Line Items</CardTitle>
              <CardDescription className="text-xs">Add products, services, or subscription charges.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Line Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {fields.map((field, index) => {
                const itemQty = Number(watch(`items.${index}.quantity`) || 0);
                const itemPrice = Number(watch(`items.${index}.unit_price`) || 0);
                const lineTotal = itemQty * itemPrice;

                return (
                  <div key={field.id} className="flex flex-col sm:flex-row gap-3 items-end p-3 border rounded-lg bg-muted/20">
                    <div className="flex-1 w-full space-y-1">
                      <Label className="text-xs">Item Description</Label>
                      <Input
                        {...register(`items.${index}.description` as const, { required: true })}
                        placeholder="e.g. Monthly Retainer / Web Development Services"
                      />
                    </div>
                    <div className="w-full sm:w-28 space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="w-full sm:w-36 space-y-1">
                      <Label className="text-xs">Unit Rate ({selectedCurrency})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unit_price` as const, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="w-full sm:w-36 text-right pb-2 font-medium text-sm">
                      <span className="text-xs text-muted-foreground block">Amount</span>
                      {formatCurrency(lineTotal, selectedCurrency)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Calculations & Totals Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes & Payment Instructions</Label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:ring-2 focus:ring-primary"
                    placeholder="Bank details, wire instructions, or client notes..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Terms & Conditions</Label>
                  <textarea
                    {...register('terms')}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:ring-2 focus:ring-primary"
                    placeholder="Standard terms..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Custom Footer Note (Optional)</Label>
                  <Input
                    {...register('footer_note')}
                    placeholder="Thank you for choosing us."
                  />
                </div>
              </div>

              <div className="space-y-2 bg-muted/40 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal, selectedCurrency)}</span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Discount ({selectedCurrency})</span>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-right text-xs"
                      {...register('discount', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Tax Rate (%)</span>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-right text-xs"
                      {...register('tax_rate', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                {watchTaxRate > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground pl-4">
                    <span>Tax Amount ({watchTaxRate}%)</span>
                    <span>+{formatCurrency(taxAmount, selectedCurrency)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Shipping / Extra Fee</span>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-right text-xs"
                      {...register('shipping', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-lg font-bold pt-3 border-t">
                  <span>Total Due</span>
                  <span className="text-primary">{formatCurrency(total, selectedCurrency)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/app/invoices')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save & View Invoice'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
