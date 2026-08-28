import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bug, Plus, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_COLORS: Record<string, string> = {
  Reported: 'bg-blue-100 text-blue-700',
  Confirmed: 'bg-purple-100 text-purple-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Testing: 'bg-cyan-100 text-cyan-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
  Rejected: 'bg-red-100 text-red-700',
};

const STATUS_TABS = ['All', 'Reported', 'Confirmed', 'In Progress', 'Testing', 'Resolved', 'Closed'];

export default function BugsComponent() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('All');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'Medium',
    priority: 'Normal',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: '',
    browser: '',
    device: '',
    client_id: '',
  });

  const { data: bugs, isLoading } = useQuery({
    queryKey: ['admin_bugs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*, client:clients(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients_for_bugs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const createBug = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('bug_reports').insert([{
        ...form,
        organization_id: organizationId,
        client_id: form.client_id || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_bugs'] });
      setOpen(false);
      setForm({ title: '', description: '', severity: 'Medium', priority: 'Normal', steps_to_reproduce: '', expected_result: '', actual_result: '', browser: '', device: '', client_id: '' });
      toast({ title: 'Bug report created successfully.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_bugs'] }),
  });

  const filtered = activeTab === 'All' ? bugs : bugs?.filter((b: any) => b.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="h-7 w-7 text-red-500" /> Bug Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage all reported bugs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Report Bug</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report a New Bug</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createBug.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of the bug" required />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Description *</Label>
                  <textarea className="w-full min-h-[80px] p-2 border rounded-md bg-background text-sm resize-y" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed description..." required />
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                    {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {['Low', 'Normal', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Client (Optional)</Label>
                  <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                    <option value="">No specific client</option>
                    {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Steps to Reproduce</Label>
                  <textarea className="w-full min-h-[60px] p-2 border rounded-md bg-background text-sm resize-y" value={form.steps_to_reproduce} onChange={e => setForm(p => ({ ...p, steps_to_reproduce: e.target.value }))} placeholder="1. Go to... 2. Click on..." />
                </div>
                <div className="space-y-2">
                  <Label>Expected Result</Label>
                  <Input value={form.expected_result} onChange={e => setForm(p => ({ ...p, expected_result: e.target.value }))} placeholder="What should happen" />
                </div>
                <div className="space-y-2">
                  <Label>Actual Result</Label>
                  <Input value={form.actual_result} onChange={e => setForm(p => ({ ...p, actual_result: e.target.value }))} placeholder="What actually happens" />
                </div>
                <div className="space-y-2">
                  <Label>Browser</Label>
                  <Input value={form.browser} onChange={e => setForm(p => ({ ...p, browser: e.target.value }))} placeholder="Chrome 120, Firefox 119..." />
                </div>
                <div className="space-y-2">
                  <Label>Device / OS</Label>
                  <Input value={form.device} onChange={e => setForm(p => ({ ...p, device: e.target.value }))} placeholder="Windows 11, iPhone 15..." />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createBug.isPending}>
                  {createBug.isPending ? 'Submitting...' : 'Submit Bug Report'}
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
              {tab === 'All' ? bugs?.length || 0 : bugs?.filter((b: any) => b.status === tab).length || 0}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading bug reports...</div>
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="h-12 w-12 text-green-400/40 mb-3" />
            <p className="text-muted-foreground">No bugs in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((bug: any) => (
            <Card key={bug.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="font-semibold">{bug.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[bug.severity] || 'bg-muted text-muted-foreground'}`}>
                        {bug.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bug.status] || 'bg-muted text-muted-foreground'}`}>
                        {bug.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{bug.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(bug.created_at).toLocaleDateString()}
                      </span>
                      {bug.client?.name && (
                        <span className="bg-muted px-2 py-0.5 rounded">{bug.client.name}</span>
                      )}
                      <span>Priority: {bug.priority}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <select
                      value={bug.status}
                      onChange={e => updateStatus.mutate({ id: bug.id, status: e.target.value })}
                      className="text-xs rounded border p-1.5 bg-background cursor-pointer"
                    >
                      {['Reported', 'Confirmed', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Rejected'].map(s => (
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
