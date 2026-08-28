import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lightbulb, Plus, Clock, ThumbsUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  Submitted: 'bg-slate-100 text-slate-600',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
};

const STATUS_TABS = ['All', 'Submitted', 'Under Review', 'Approved', 'In Progress', 'Completed', 'Rejected'];

export default function FeatureRequestsComponent() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('All');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Normal',
    client_id: '',
  });

  const { data: features, isLoading } = useQuery({
    queryKey: ['admin_features', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('feature_requests')
        .select('*, client:clients(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) {
        // Table may not exist — return empty gracefully
        console.warn('feature_requests:', error.message);
        return [];
      }
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients_for_features', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const createFeature = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error('Please select a client for this feature request.');
      const { error } = await supabase.from('feature_requests').insert([{
        ...form,
        organization_id: organizationId,
        client_id: form.client_id,
        status: 'Submitted',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_features'] });
      setOpen(false);
      setForm({ title: '', description: '', priority: 'Normal', client_id: '' });
      toast({ title: 'Feature request created.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('feature_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_features'] }),
  });

  const filtered = activeTab === 'All' ? features : features?.filter((f: any) => f.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-amber-400" /> Feature Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage client feature requests and their status</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Feature Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createFeature.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Feature request title" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea className="w-full min-h-[100px] p-2 border rounded-md bg-background text-sm resize-y" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the feature request in detail..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {['Low', 'Normal', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} required>
                    <option value="">Select a client...</option>
                    {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createFeature.isPending}>
                  {createFeature.isPending ? 'Creating...' : 'Create Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {tab}
            <span className="ml-1.5 text-xs opacity-70">
              {tab === 'All' ? features?.length || 0 : features?.filter((f: any) => f.status === tab).length || 0}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading feature requests...</div>
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lightbulb className="h-12 w-12 text-amber-300/40 mb-3" />
            <p className="text-muted-foreground">No feature requests here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((feature: any) => (
            <Card key={feature.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <ThumbsUp className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="font-semibold">{feature.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[feature.status] || 'bg-muted text-muted-foreground'}`}>
                        {feature.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{feature.description || 'No description provided.'}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(feature.created_at).toLocaleDateString()}
                      </span>
                      {feature.client?.name && (
                        <span className="bg-muted px-2 py-0.5 rounded">{feature.client.name}</span>
                      )}
                      <span>Priority: {feature.priority}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <select
                      value={feature.status}
                      onChange={e => updateStatus.mutate({ id: feature.id, status: e.target.value })}
                      className="text-xs rounded border p-1.5 bg-background cursor-pointer"
                    >
                      {['Submitted', 'Under Review', 'Approved', 'In Progress', 'Completed', 'Rejected'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
