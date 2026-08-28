import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bug, Plus, Clock } from 'lucide-react';
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

export default function ClientBugs() {
  const { clientId, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'Medium',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: '',
    browser: '',
    device: '',
  });

  const { data: bugs, isLoading } = useQuery({
    queryKey: ['portal_bugs', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const reportBug = useMutation({
    mutationFn: async () => {
      if (!clientId || !organizationId) throw new Error('Not authenticated');
      const { error } = await supabase.from('bug_reports').insert([{
        ...form,
        client_id: clientId,
        organization_id: organizationId,
        status: 'Reported',
        priority: 'Normal',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_bugs'] });
      setOpen(false);
      setForm({ title: '', description: '', severity: 'Medium', steps_to_reproduce: '', expected_result: '', actual_result: '', browser: '', device: '' });
      toast({ title: 'Bug reported!', description: 'Our team will review your report shortly.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading bug reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="h-7 w-7 text-red-500" /> Bug Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Report and track bugs you've encountered</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Report a Bug</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report a Bug</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); reportBug.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Bug Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Short summary of the bug" required />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <textarea className="w-full min-h-[80px] p-2 border rounded-md bg-background text-sm resize-y" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe what's happening in detail..." required />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <select className="w-full rounded-md border p-2 bg-background text-sm" value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                  {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Steps to Reproduce</Label>
                <textarea className="w-full min-h-[60px] p-2 border rounded-md bg-background text-sm resize-y" value={form.steps_to_reproduce} onChange={e => setForm(p => ({ ...p, steps_to_reproduce: e.target.value }))} placeholder="1. Go to...\n2. Click...\n3. See error" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected Result</Label>
                  <Input value={form.expected_result} onChange={e => setForm(p => ({ ...p, expected_result: e.target.value }))} placeholder="What should happen" />
                </div>
                <div className="space-y-2">
                  <Label>Actual Result</Label>
                  <Input value={form.actual_result} onChange={e => setForm(p => ({ ...p, actual_result: e.target.value }))} placeholder="What actually happened" />
                </div>
                <div className="space-y-2">
                  <Label>Browser</Label>
                  <Input value={form.browser} onChange={e => setForm(p => ({ ...p, browser: e.target.value }))} placeholder="Chrome, Safari..." />
                </div>
                <div className="space-y-2">
                  <Label>Device / OS</Label>
                  <Input value={form.device} onChange={e => setForm(p => ({ ...p, device: e.target.value }))} placeholder="Windows, iPhone..." />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={reportBug.isPending}>
                  {reportBug.isPending ? 'Submitting...' : 'Submit Bug Report'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!bugs || bugs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bug className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">No bug reports yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Spotted something? Click "Report a Bug" above.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Bug Reports ({bugs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {bugs.map((bug: any) => (
                <div key={bug.id} className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{bug.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{bug.description}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(bug.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${SEVERITY_COLORS[bug.severity] || 'bg-muted'}`}>
                      {bug.severity}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[bug.status] || 'bg-muted text-muted-foreground'}`}>
                      {bug.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
