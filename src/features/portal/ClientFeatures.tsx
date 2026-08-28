import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lightbulb, Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  Submitted: 'bg-slate-100 text-slate-600',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default function ClientFeatures() {
  const { clientId, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Normal',
  });

  const { data: features, isLoading } = useQuery({
    queryKey: ['portal_features', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('feature_requests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('feature_requests query failed:', error.message);
        return [];
      }
      return data || [];
    },
    enabled: !!clientId,
  });

  const submitFeature = useMutation({
    mutationFn: async () => {
      if (!clientId || !organizationId) throw new Error('Not authenticated');
      const { error } = await supabase.from('feature_requests').insert([{
        ...form,
        client_id: clientId,
        organization_id: organizationId,
        status: 'Submitted',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_features'] });
      setOpen(false);
      setForm({ title: '', description: '', priority: 'Normal' });
      toast({ title: 'Request submitted!', description: 'We\'ll review your feature request and get back to you.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading feature requests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-amber-400" /> Feature Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Submit and track your feature requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Submit Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit a Feature Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); submitFeature.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Feature Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Dark mode support" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  className="w-full min-h-[120px] p-2 border rounded-md bg-background text-sm resize-y"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the feature you'd like to see and how it would help you..."
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {['Low', 'Normal', 'High'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitFeature.isPending}>
                  {submitFeature.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!features || features.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lightbulb className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">No feature requests yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Have an idea? Click "Submit Request" to share it.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Feature Requests ({features.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {features.map((feature: any) => (
                <div key={feature.id} className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{feature.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                      {feature.description || 'No description provided.'}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(feature.created_at).toLocaleDateString()}
                      <span>· Priority: {feature.priority}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap self-start sm:self-center ${STATUS_COLORS[feature.status] || 'bg-muted text-muted-foreground'}`}>
                    {feature.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
