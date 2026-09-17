import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  LifeBuoy, Plus, Image as ImageIcon, X, Bug, CheckSquare, 
  Bookmark, Search, ChevronRight, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ClientIssueType = 'Bug' | 'Task' | 'Feature' | 'Support';

const ISSUE_TYPES: { id: ClientIssueType; label: string; desc: string; icon: any; color: string }[] = [
  { id: 'Bug', label: 'Bug Report', desc: 'Something is broken, displaying error, or not working', icon: Bug, color: 'text-rose-600' },
  { id: 'Feature', label: 'Feature Request', desc: 'Suggest a new capability or improvement', icon: Bookmark, color: 'text-emerald-600' },
  { id: 'Task', label: 'Service Task', desc: 'Request an update or modification to existing work', icon: CheckSquare, color: 'text-blue-600' },
  { id: 'Support', label: 'General Support', desc: 'Questions about account, billing, or platform', icon: LifeBuoy, color: 'text-amber-600' },
];

export default function ClientTickets() {
  const { clientId, organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [issueType, setIssueType] = useState<ClientIssueType>('Bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appLocation, setAppLocation] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['portal_tickets', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (files.length + selected.length > 10) {
        toast({ title: 'Limit exceeded', description: 'You can upload up to 10 images max.', variant: 'destructive' });
        return;
      }
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!clientId || !organizationId || !user) throw new Error('Missing context');

      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      const ticketNum = `FC-${String((count || 0) + 101).padStart(3, '0')}`;

      let combinedDescription = description;
      if (issueType === 'Bug' && (stepsToReproduce || actualResult || expectedResult)) {
        combinedDescription = `${description}\n\n### Steps to Reproduce:\n${stepsToReproduce}\n\n### Expected:\n${expectedResult}\n\n### Actual:\n${actualResult}`;
      }

      // 1. Insert ticket
      let newTicket: any = null;
      try {
        const { data, error } = await supabase.from('tickets').insert([{
          organization_id: organizationId,
          client_id: clientId,
          created_by: user.id,
          ticket_number: ticketNum,
          title,
          description: combinedDescription,
          app_location: appLocation || 'General',
          priority,
          category: issueType,
          issue_type: issueType,
          steps_to_reproduce: stepsToReproduce || null,
          expected_result: expectedResult || null,
          actual_result: actualResult || null,
          status: 'Open',
        }]).select().single();
        if (error) throw error;
        newTicket = data;
      } catch {
        const { data, error } = await supabase.from('tickets').insert([{
          organization_id: organizationId,
          client_id: clientId,
          created_by: user.id,
          ticket_number: ticketNum,
          title,
          description: combinedDescription,
          app_location: appLocation || 'General',
          priority,
          category: issueType,
          status: 'Open',
        }]).select().single();
        if (error) throw error;
        newTicket = data;
      }

      // 2. Upload attachments
      const uploadedUrls: string[] = [];
      if (files.length > 0 && newTicket) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${organizationId}/tickets/${newTicket.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket_attachments')
            .upload(fileName, file);
            
          if (!uploadError) {
            const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(fileName);
            uploadedUrls.push(data.publicUrl);
          }
        }

        if (uploadedUrls.length > 0) {
          await supabase.from('tickets').update({ attachments: uploadedUrls }).eq('id', newTicket.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_tickets'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Ticket Raised', description: 'Your ticket has been logged with our team.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAppLocation('');
    setStepsToReproduce('');
    setExpectedResult('');
    setActualResult('');
    setPriority('Normal');
    setIssueType('Bug');
    setFiles([]);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-amber-100 text-amber-700';
      case 'Waiting for Client': return 'bg-purple-100 text-purple-700';
      case 'Resolved': return 'bg-green-100 text-green-700';
      case 'Closed': return 'bg-slate-100 text-slate-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredTickets = tickets?.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets & Issues</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Raise defects, request features, and track progress with your technical support team.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Raise New Ticket
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets by key or summary..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {['All', 'Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted border bg-background'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p>Loading tickets...</p>
        </div>
      ) : !filteredTickets || filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LifeBuoy className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-base">No support tickets found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Click "Raise New Ticket" to report an issue or request an update.
            </p>
            <Button size="sm" className="mt-4" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Raise Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Tickets ({filteredTickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {filteredTickets.map((ticket: any) => {
                const type = ticket.issue_type || ticket.category || 'Bug';
                return (
                  <Link
                    to={`/portal/tickets/${ticket.id}`}
                    key={ticket.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/40 transition-colors px-3 rounded-lg -mx-3 block"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {ticket.ticket_number}
                        </span>
                        <span className="font-semibold text-sm text-foreground hover:text-primary">
                          {ticket.title}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{type}</span>
                        {ticket.app_location && <span>• {ticket.app_location}</span>}
                        <span>• {new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ticket.priority === 'Urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : ticket.priority === 'High'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raise Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raise Support Ticket / Issue</DialogTitle>
            <DialogDescription className="text-xs">
              Provide details so our team can resolve your request efficiently.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); createTicket.mutate(); }} className="space-y-4 mt-2">
            {/* Issue Type Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What type of issue is this?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ISSUE_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = issueType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setIssueType(t.id)}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-input bg-card hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${t.color}`} />
                      <span className="font-semibold text-xs text-foreground">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject / Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue or request"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">App Location / Page</Label>
                <Input
                  value={appLocation}
                  onChange={(e) => setAppLocation(e.target.value)}
                  placeholder="e.g. Dashboard > Services"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="Low">Low - Minor question or suggestion</option>
                  <option value="Normal">Normal - Standard priority</option>
                  <option value="High">High - Impairing core work</option>
                  <option value="Urgent">Urgent - Critical blocker</option>
                </select>
              </div>
            </div>

            {/* If Bug: Steps to Reproduce */}
            {issueType === 'Bug' && (
              <div className="p-3 rounded-lg border bg-rose-50/30 dark:bg-rose-950/10 space-y-3">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                  Bug Reproduction Details
                </span>
                <div className="space-y-1">
                  <Label className="text-[11px]">Steps to Reproduce</Label>
                  <textarea
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border p-2 text-xs bg-background"
                    placeholder="1. Click on meetings&#10;2. Select join room..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Expected Behavior</Label>
                    <Input
                      value={expectedResult}
                      onChange={(e) => setExpectedResult(e.target.value)}
                      placeholder="What should happen"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Actual Behavior</Label>
                    <Input
                      value={actualResult}
                      onChange={(e) => setActualResult(e.target.value)}
                      placeholder="What actually happens"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Detailed Description *</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                placeholder="Describe your issue or request in full..."
              />
            </div>

            {/* Attachments */}
            <div className="space-y-1.5">
              <Label className="text-xs">Screenshots / Attachments (Max 10)</Label>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="preview"
                          className="h-14 w-14 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= 10}
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Attach Screenshots ({files.length}/10)
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTicket.isPending || !title || !description}>
                {createTicket.isPending ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
