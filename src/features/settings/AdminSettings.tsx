import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2, Save } from 'lucide-react';
import { CURRENCIES } from '@/lib/currencies';
import { getBillingSettings, saveBillingSettings, type BillingSettings } from '@/lib/billingSettings';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function AdminSettings() {
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<BillingSettings>(getBillingSettings());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const current = getBillingSettings();
    // If company email is not set, initialize with user's email as default suggestion
    if (!current.companyEmail && user?.email) {
      current.companyEmail = user.email;
    }
    setSettings(current);
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const saved = saveBillingSettings(settings);
      setSettings(saved);

      // Also attempt to update organization name if organizationId exists
      if (organizationId && settings.companyName) {
        try {
          await supabase
            .from('organizations')
            .update({ name: settings.companyName })
            .eq('id', organizationId);
        } catch {
          // Non-critical if table column permissions differ
        }
      }

      toast({
        title: 'Settings Saved',
        description: 'Company & billing defaults updated successfully.'
      });
    } catch (err: any) {
      toast({
        title: 'Error Saving Settings',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account profile, billing configuration, and customized company branding.
        </p>
      </div>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your authenticated administrative profile</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Account Email</Label>
            <div className="text-sm font-semibold mt-1">{user?.email}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Role</Label>
            <div className="text-sm font-semibold mt-1">Super Admin / Organization Owner</div>
          </div>
        </CardContent>
      </Card>

      {/* Company & Billing Defaults Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Company & Billing Customization</CardTitle>
          </div>
          <CardDescription>
            Configure your business contact details and defaults. These apply automatically to all newly created or generated invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company / Brand Name</Label>
                <Input
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="e.g. Freelancecomm"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Company / Support Email</Label>
                <Input
                  value={settings.companyEmail}
                  onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  placeholder="e.g. freelancecomm9@gmail.com"
                />
                <p className="text-xs text-muted-foreground">
                  The unwanted billing@freelancecomm.site address is permanently removed. Put your actual email here or leave blank.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Company Phone</Label>
                <Input
                  value={settings.companyPhone}
                  onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Default Currency</Label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol}) - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Company Headquarters / Address</Label>
              <Input
                value={settings.companyAddress}
                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                placeholder="e.g. Silicon Valley, CA, USA"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Default Invoice Payment Terms</Label>
              <Input
                value={settings.defaultPaymentTerms}
                onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: e.target.value })}
                placeholder="Payment due within 14 days of invoice date."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Default Customer Notes</Label>
              <textarea
                value={settings.defaultNotes}
                onChange={(e) => setSettings({ ...settings, defaultNotes: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2.5 text-sm"
                placeholder="Thank you for your business. Please remit payment by the due date."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Default Invoice Footer Note</Label>
              <Input
                value={settings.defaultFooterNote}
                onChange={(e) => setSettings({ ...settings, defaultFooterNote: e.target.value })}
                placeholder="Thank you for choosing Freelancecomm."
              />
              <p className="text-xs text-muted-foreground">
                Appears at the very bottom of every invoice. You can completely customize or change this text anytime.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
