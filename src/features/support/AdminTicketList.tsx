import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { 
  LifeBuoy, Clock, ChevronRight, Download, Plus, Kanban, List, 
  Bug, CheckSquare, Bookmark, AlertOctagon, Sparkles, Filter, 
  Search, ArrowUp, ArrowDown, Minus, User, Image as ImageIcon, X, Loader2
} from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type IssueType = 'Bug' | 'Task' | 'Story' | 'Support' | 'Improvement';

export const JIRA_ISSUE_TYPES: { id: IssueType; name: string; icon: any; color: string; bg: string }[] = [
  { id: 'Bug', name: 'Bug / Defect', icon: Bug, color: 'text-rose-600', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Task', name: 'Task', icon: CheckSquare, color: 'text-blue-600', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Story', name: 'Story / Feature', icon: Bookmark, color: 'text-emerald-600', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Support', name: 'Support Request', icon: LifeBuoy, color: 'text-amber-600', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Improvement', name: 'Improvement', icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
];

export const JIRA_PRIORITIES: Record<string, { label: string; icon: any; color: string; border: string }> = {
  Urgent: { label: 'Highest', icon: AlertOctagon, color: 'text-rose-600 bg-rose-50', border: 'border-rose-200' },
  High: { label: 'High', icon: ArrowUp, color: 'text-orange-600 bg-orange-50', border: 'border-orange-200' },
  Normal: { label: 'Medium', icon: Minus, color: 'text-amber-600 bg-amber-50', border: 'border-amber-200' },
  Low: { label: 'Low', icon: ArrowDown, color: 'text-blue-600 bg-blue-50', border: 'border-blue-200' },
};

export const JIRA_COLUMNS = [
  { id: 'Open', title: 'To Do / Backlog', color: 'border-blue-500' },
  { id: 'In Progress', title: 'In Progress', color: 'border-amber-500' },
  { id: 'Waiting for Client', title: 'In Review / Waiting', color: 'border-purple-500' },
  { id: 'Resolved', title: 'Done / Resolved', color: 'border-emerald-500' },
  { id: 'Closed', title: 'Closed', color: 'border-slate-500' },
];

export const COMPONENTS_LIST = [
  'Dashboard & Analytics',
  'Invoices & Billing',
  'Subscriptions',
  'Client Portal',
  'Meetings & Video Sync',
  'Support & Tickets',
  'Projects & Tasks',
  'Authentication & Security',
  'Messaging & Chat',
  'API & Webhooks',
];

export default function AdminTicketList() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeStatusTab, setActiveStatusTab] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New ticket form fields
  const [issueType, setIssueType] = useState<IssueType>('Bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [component, setComponent] = useState('General');
  const [estimatePoints, setEstimatePoints] = useState<number>(3);
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [environment, setEnvironment] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin_tickets', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          client:clients(id, name, email)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients_ticket_create', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name');
      if (error) throw error;
      return data || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tickets'] });
    },
  });

  const createJiraTicket = useMutation({
    mutationFn: async () => {
      if (!organizationId || !user) throw new Error('Missing authentication context');
      if (!title.trim()) throw new Error('Summary title is required');

      // 1. Generate key like FC-101
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      const ticketNum = `FC-${String((count || 0) + 101).padStart(3, '0')}`;

      // Build combined description if structured bug fields used
      let fullDescription = description;
      if (issueType === 'Bug' && (stepsToReproduce || actualResult || expectedResult)) {
        fullDescription = `${description}\n\n### Steps to Reproduce:\n${stepsToReproduce}\n\n### Expected Result:\n${expectedResult}\n\n### Actual Result:\n${actualResult}`;
      }

      // Try inserting with extended Jira columns, fall back gracefully if schema is base
      let newTicket: any = null;
      try {
        const { data, error } = await supabase
          .from('tickets')
          .insert([{
            organization_id: organizationId,
            client_id: clientId || (clients?.[0]?.id || null),
            created_by: user.id,
            ticket_number: ticketNum,
            title,
            description: fullDescription,
            priority,
            category: issueType,
            status: 'Open',
            issue_type: issueType,
            component,
            estimate_points: estimatePoints,
            steps_to_reproduce: stepsToReproduce || null,
            expected_result: expectedResult || null,
            actual_result: actualResult || null,
            environment: environment || null
          }])
          .select()
          .single();

        if (error) throw error;
        newTicket = data;
      } catch {
        // Fallback with standard schema
        const { data, error } = await supabase
          .from('tickets')
          .insert([{
            organization_id: organizationId,
            client_id: clientId || (clients?.[0]?.id || null),
            created_by: user.id,
            ticket_number: ticketNum,
            title,
            description: fullDescription,
            priority,
            category: issueType,
            status: 'Open',
            app_location: component
          }])
          .select()
          .single();

        if (error) throw error;
        newTicket = data;
      }

      // 2. Upload attachments if any
      if (files.length > 0 && newTicket) {
        const uploadedUrls: string[] = [];
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

      return newTicket;
    },
    onSuccess: (newTkt) => {
      toast({
        title: 'Issue Created',
        description: `Ticket ${newTkt.ticket_number} created successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ['admin_tickets'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error Creating Issue', description: err.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setExpectedResult('');
    setActualResult('');
    setEnvironment('');
    setFiles([]);
    setPriority('Normal');
    setEstimatePoints(3);
  };

  const handleExport = () => {
    if (tickets) {
      exportToCSV(tickets, 'jira_tickets.csv');
    }
  };

  const getIssueTypeConfig = (typeStr?: string) => {
    const matched = JIRA_ISSUE_TYPES.find((t) => t.id.toLowerCase() === (typeStr || '').toLowerCase() || t.name.toLowerCase().includes((typeStr || '').toLowerCase()));
    return matched || JIRA_ISSUE_TYPES[1]; // default Task
  };

  // Filtered tickets
  const filteredTickets = tickets?.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const ticketType = t.issue_type || t.category || 'Task';
    const matchesType = typeFilter === 'All' || ticketType.toLowerCase().includes(typeFilter.toLowerCase());
    const matchesStatus = activeStatusTab === 'All' || t.status === activeStatusTab;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Issue Tracker & Tickets</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              Jira Experience
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track defects, tasks, feature requests, and customer support with Kanban workflow transitions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="border rounded-md p-1 flex bg-card">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setViewMode('kanban')}
            >
              <Kanban className="h-3.5 w-3.5 mr-1.5" /> Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> List
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleExport} disabled={!tickets || tickets.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>

          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Raise Ticket
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by summary, key (FC-101), client..."
              className="w-full pl-8 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Issue Type Filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setTypeFilter('All')}
              className={`px-2.5 py-1 rounded text-xs font-medium border whitespace-nowrap transition-colors ${
                typeFilter === 'All' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted bg-background'
              }`}
            >
              All Types
            </button>
            {JIRA_ISSUE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setTypeFilter(type.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium border whitespace-nowrap transition-colors flex items-center gap-1 ${
                  typeFilter === type.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted bg-background'
                }`}
              >
                <type.icon className="h-3 w-3" />
                {type.id}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter for List View */}
        {viewMode === 'list' && (
          <div className="flex gap-1 overflow-x-auto">
            {['All', 'Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveStatusTab(tab)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  activeStatusTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted border'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
          <p>Loading Jira issue tracker...</p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ================= JIRA KANBAN BOARD VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start overflow-x-auto pb-4">
          {JIRA_COLUMNS.map((col) => {
            const columnTickets = filteredTickets?.filter((t) => t.status === col.id) || [];

            return (
              <div key={col.id} className="bg-muted/30 rounded-xl p-3 border flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 border-b mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="font-semibold text-xs tracking-tight uppercase text-slate-800 dark:text-slate-200">
                      {col.title}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {columnTickets.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {columnTickets.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground/60 border border-dashed rounded-lg">
                      No issues
                    </div>
                  ) : (
                    columnTickets.map((ticket) => {
                      const typeConfig = getIssueTypeConfig(ticket.issue_type || ticket.category);
                      const priorityConfig = JIRA_PRIORITIES[ticket.priority] || JIRA_PRIORITIES.Normal;
                      const PriorityIcon = priorityConfig.icon;
                      const TypeIcon = typeConfig.icon;

                      return (
                        <div
                          key={ticket.id}
                          className="bg-card p-3 rounded-lg border shadow-sm hover:shadow transition-all group flex flex-col gap-2 relative"
                        >
                          {/* Card Header: Type, Key, Priority */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className={`p-1 rounded ${typeConfig.bg}`} title={typeConfig.name}>
                                <TypeIcon className="h-3 w-3" />
                              </span>
                              <Link
                                to={`/app/tickets/${ticket.id}`}
                                className="font-mono font-bold text-primary hover:underline text-[11px]"
                              >
                                {ticket.ticket_number}
                              </Link>
                            </div>
                            <span
                              className={`p-0.5 rounded flex items-center gap-0.5 text-[10px] font-semibold ${priorityConfig.color}`}
                              title={`Priority: ${priorityConfig.label}`}
                            >
                              <PriorityIcon className="h-3 w-3" />
                            </span>
                          </div>

                          {/* Summary Title */}
                          <Link
                            to={`/app/tickets/${ticket.id}`}
                            className="font-medium text-xs text-slate-900 dark:text-slate-100 hover:text-primary line-clamp-2"
                          >
                            {ticket.title}
                          </Link>

                          {/* Component / Location Badge */}
                          {(ticket.component || ticket.app_location) && (
                            <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded w-fit truncate max-w-full">
                              {ticket.component || ticket.app_location}
                            </span>
                          )}

                          {/* Card Footer: Client, Estimate, Quick Transition Dropdown */}
                          <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[90px] font-medium text-foreground">
                              {ticket.client?.name || 'Internal'}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {ticket.estimate_points && (
                                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                                  {ticket.estimate_points} pts
                                </span>
                              )}

                              {/* Quick column transition select */}
                              <select
                                value={ticket.status}
                                onChange={(e) => updateStatus.mutate({ id: ticket.id, status: e.target.value })}
                                className="text-[10px] rounded border bg-background px-1 py-0.5 cursor-pointer font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {JIRA_COLUMNS.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    → {c.id}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= JIRA TABLE LIST VIEW ================= */
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3.5 w-12">Type</th>
                <th className="p-3.5 w-28">Key</th>
                <th className="p-3.5">Summary</th>
                <th className="p-3.5">Client</th>
                <th className="p-3.5">Component</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {!filteredTickets || filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    No tickets match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const typeConfig = getIssueTypeConfig(ticket.issue_type || ticket.category);
                  const priorityConfig = JIRA_PRIORITIES[ticket.priority] || JIRA_PRIORITIES.Normal;
                  const PriorityIcon = priorityConfig.icon;
                  const TypeIcon = typeConfig.icon;

                  return (
                    <tr key={ticket.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3.5">
                        <span className={`p-1.5 rounded inline-block ${typeConfig.bg}`} title={typeConfig.name}>
                          <TypeIcon className="h-3.5 w-3.5" />
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-primary">
                        <Link to={`/app/tickets/${ticket.id}`} className="hover:underline">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="p-3.5 font-medium text-foreground max-w-xs truncate">
                        <Link to={`/app/tickets/${ticket.id}`} className="hover:underline">
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{ticket.client?.name || '-'}</td>
                      <td className="p-3.5">
                        <span className="text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {ticket.component || ticket.app_location || 'General'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] ${priorityConfig.color}`}>
                          <PriorityIcon className="h-3 w-3" />
                          {priorityConfig.label}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={ticket.status}
                          onChange={(e) => updateStatus.mutate({ id: ticket.id, status: e.target.value })}
                          className="text-xs rounded border px-2 py-1 bg-background"
                        >
                          {JIRA_COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/app/tickets/${ticket.id}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= RAISE JIRA TICKET MODAL ================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-primary/10 text-primary">
                <Bug className="h-5 w-5" />
              </span>
              <DialogTitle className="text-xl">Raise Jira Issue / Ticket</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Log bugs, tasks, user stories, or support requests with full reproduction context and attachments.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createJiraTicket.mutate();
            }}
            className="space-y-4 mt-2"
          >
            {/* Issue Type Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Issue Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {JIRA_ISSUE_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = issueType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setIssueType(type.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 items-start ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-input bg-card hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${type.color}`} />
                      <span className="font-semibold text-xs text-foreground">{type.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Summary Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  issueType === 'Bug'
                    ? 'e.g. Invoice download fails when currency is AED'
                    : 'e.g. Add export to CSV feature on subscriber list'
                }
                required
              />
            </div>

            {/* Client & Component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client Organization</Label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="">Select client...</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Component / Feature Area</Label>
                <select
                  value={component}
                  onChange={(e) => setComponent(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  {COMPONENTS_LIST.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority & Estimation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="Urgent">Highest / Urgent</option>
                  <option value="High">High</option>
                  <option value="Normal">Medium / Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Story Points / Estimate</Label>
                <select
                  value={estimatePoints}
                  onChange={(e) => setEstimatePoints(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value={1}>1 pt (Very Quick)</option>
                  <option value={2}>2 pts (Minor)</option>
                  <option value={3}>3 pts (Standard)</option>
                  <option value={5}>5 pts (Moderate)</option>
                  <option value={8}>8 pts (Complex)</option>
                  <option value={13}>13 pts (Epic / Major)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Environment / Browser</Label>
                <Input
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  placeholder="Chrome 125, macOS Sonoma"
                  className="text-xs"
                />
              </div>
            </div>

            {/* If Bug: Structured Repro Steps */}
            {issueType === 'Bug' && (
              <div className="p-3 rounded-lg border bg-rose-50/30 dark:bg-rose-950/10 space-y-3">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                  Defect Reproduction Details
                </span>
                <div className="space-y-1">
                  <Label className="text-[11px]">Steps to Reproduce</Label>
                  <textarea
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border p-2 text-xs bg-background"
                    placeholder="1. Go to Invoices -> Create&#10;2. Select currency AED&#10;3. Click save draft"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Expected Result</Label>
                    <Input
                      value={expectedResult}
                      onChange={(e) => setExpectedResult(e.target.value)}
                      placeholder="Invoice renders with AED symbol"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Actual Result</Label>
                    <Input
                      value={actualResult}
                      onChange={(e) => setActualResult(e.target.value)}
                      placeholder="Shows blank symbol error"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description / Acceptance Criteria</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                placeholder="Detailed explanation of the issue, user story, or request..."
                required
              />
            </div>

            {/* Attachments */}
            <div className="space-y-1.5">
              <Label className="text-xs">Screenshots & Media (Max 10)</Label>
              <div className="p-3 border border-dashed rounded-lg bg-muted/20">
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="relative group">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt="preview"
                            className="h-14 w-14 object-cover rounded border"
                          />
                        ) : (
                          <div className="h-14 w-14 bg-background rounded border flex items-center justify-center text-[9px] p-1 text-center truncate">
                            {file.name}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-md"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="text-xs w-full cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground"
                  onChange={(e) => {
                    if (e.target.files) {
                      const selected = Array.from(e.target.files);
                      setFiles((prev) => [...prev, ...selected].slice(0, 10));
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createJiraTicket.isPending || !title}>
                {createJiraTicket.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Issue...
                  </>
                ) : (
                  'Create Issue'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
