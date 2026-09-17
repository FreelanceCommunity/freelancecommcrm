import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, Image as ImageIcon, X, MapPin, CheckCircle2, 
  Send, Lock, 
  Trash2, ExternalLink, Download, Loader2, Copy, Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JIRA_ISSUE_TYPES, JIRA_PRIORITIES, JIRA_COLUMNS } from './AdminTicketList';

export default function AdminTicketView() {
  const { id } = useParams<{ id: string }>();
  const { user, organizationId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'comments' | 'internal'>('all');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          client:clients(id, name, email),
          assignee:profiles!assigned_to(first_name, last_name, email),
          creator:profiles!created_by(first_name, last_name, email)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: messages } = useQuery({
    queryKey: ['ticket_messages', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*, profile:profiles(first_name, last_name, email)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const { data: staffMembers } = useQuery({
    queryKey: ['staff_members_lookup', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, email');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });

  // Realtime subscription for new ticket messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ticket_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['ticket_messages', id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateTicketField = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { error } = await supabase.from('tickets').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['admin_tickets'] });
      toast({ title: 'Issue Updated', description: 'Changes saved.' });
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  });

  const deleteTicket = useMutation({
    mutationFn: async () => {
      if (!confirm('Are you sure you want to delete this issue?')) return;
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Issue Deleted', description: 'Ticket was removed.' });
      navigate('/app/tickets');
    }
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addMessage = useMutation({
    mutationFn: async () => {
      if ((!reply.trim() && files.length === 0) || !user || !organizationId) return;
      setUploading(true);
      const uploadedUrls: string[] = [];

      try {
        if (files.length > 0) {
          for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${organizationId}/messages/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('ticket_attachments').upload(fileName, file);
            if (!uploadError) {
              const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(fileName);
              uploadedUrls.push(data.publicUrl);
            }
          }
        }

        const { error } = await supabase.from('ticket_messages').insert([{
          ticket_id: id,
          user_id: user.id,
          message: reply.trim() || (uploadedUrls.length > 0 ? 'Attached image(s)' : ''),
          is_internal: isInternal,
          attachment_url: uploadedUrls[0] || null,
          attachments: uploadedUrls
        }]);
        if (error) throw error;

        // Auto update ticket status if client waiting
        if (!isInternal && ticket?.status === 'Waiting for Client') {
          await supabase.from('tickets').update({ status: 'In Progress' }).eq('id', id);
        }
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      setReply('');
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['ticket_messages', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to send comment', description: err.message, variant: 'destructive' });
    }
  });

  const copyKey = () => {
    if (ticket?.ticket_number) {
      navigator.clipboard.writeText(ticket.ticket_number);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p>Loading Jira ticket details...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-16 text-center">
        <h2 className="text-xl font-bold text-destructive">Issue not found</h2>
        <Button className="mt-4" asChild>
          <Link to="/app/tickets">Back to Board</Link>
        </Button>
      </div>
    );
  }

  const issueType = ticket.issue_type || ticket.category || 'Task';
  const typeConfig = JIRA_ISSUE_TYPES.find((t) => t.id.toLowerCase() === issueType.toLowerCase()) || JIRA_ISSUE_TYPES[1];
  const TypeIcon = typeConfig.icon;

  const priorityConfig = JIRA_PRIORITIES[ticket.priority] || JIRA_PRIORITIES.Normal;
  const PriorityIcon = priorityConfig.icon;

  const filteredMessages = messages?.filter((msg: any) => {
    if (activeTab === 'comments') return !msg.is_internal;
    if (activeTab === 'internal') return msg.is_internal;
    return true;
  });

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Workflow Progression Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/tickets">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Board
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded flex items-center gap-1 text-xs font-semibold ${typeConfig.bg}`}>
              <TypeIcon className="h-3.5 w-3.5" /> {typeConfig.name}
            </span>

            <span className={`px-2 py-1 rounded flex items-center gap-1 text-xs font-semibold border ${priorityConfig.color} ${priorityConfig.border}`}>
              <PriorityIcon className="h-3.5 w-3.5" /> {priorityConfig.label}
            </span>

            <button
              onClick={copyKey}
              className="font-mono text-sm font-bold text-primary hover:bg-muted px-2 py-1 rounded flex items-center gap-1 transition-colors"
              title="Click to copy Jira key"
            >
              {ticket.ticket_number}
              {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 opacity-50" />}
            </button>
          </div>
        </div>

        {/* Workflow Transition Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Transition:</span>
          {ticket.status !== 'In Progress' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => updateTicketField.mutate({ status: 'In Progress' })}
            >
              Start Progress
            </Button>
          )}

          {ticket.status !== 'Waiting for Client' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => updateTicketField.mutate({ status: 'Waiting for Client' })}
            >
              Send for Review
            </Button>
          )}

          {ticket.status !== 'Resolved' && (
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => updateTicketField.mutate({ status: 'Resolved' })}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve Issue
            </Button>
          )}

          {ticket.status !== 'Closed' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 text-muted-foreground"
              onClick={() => updateTicketField.mutate({ status: 'Closed' })}
            >
              Close
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={() => deleteTicket.mutate()}
            title="Delete issue"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main 2-Column Jira Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Column (7 Columns / 70%) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Issue Summary */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {ticket.title}
            </h1>
            {(ticket.component || ticket.app_location) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>Component / App Location:</span>
                <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                  {ticket.component || ticket.app_location}
                </span>
              </div>
            )}
          </div>

          {/* Description Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
                {ticket.description}
              </div>

              {/* Environment info if present */}
              {ticket.environment && (
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border text-xs">
                  <span className="font-bold text-muted-foreground block mb-1">Environment / Platform:</span>
                  <span className="font-mono">{ticket.environment}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments Section */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Attachments ({ticket.attachments.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ticket.attachments.map((url: string, index: number) => (
                    <div
                      key={index}
                      className="group relative border rounded-lg overflow-hidden bg-muted/30 hover:border-primary cursor-pointer transition-all"
                      onClick={() => setLightboxImg(url)}
                    >
                      <img src={url} alt={`attachment-${index}`} className="h-28 w-full object-cover" />
                      <div className="p-1.5 text-[11px] truncate bg-card/90 font-medium flex items-center justify-between">
                        <span>Attachment {index + 1}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity & Comments Tabs */}
          <Card>
            <CardHeader className="pb-0 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Activity & Discussion
                </CardTitle>
                <div className="flex gap-1 pb-3">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    All ({messages?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      activeTab === 'comments' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Client Visible
                  </button>
                  <button
                    onClick={() => setActiveTab('internal')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
                      activeTab === 'internal' ? 'bg-amber-600 text-white' : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    <Lock className="h-3 w-3" /> Internal Notes
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Message List */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {!filteredMessages || filteredMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No activity logged yet.</p>
                ) : (
                  filteredMessages.map((msg: any) => {
                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                          msg.is_internal
                            ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40'
                            : 'bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {msg.profile?.first_name} {msg.profile?.last_name || msg.profile?.email || 'User'}
                            </span>
                            {msg.is_internal && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                                <Lock className="h-2.5 w-2.5" /> Internal Work Note
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>

                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line text-[13px] leading-relaxed">
                          {msg.message}
                        </p>

                        {/* Message attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {msg.attachments.map((url: string, i: number) => (
                              <img
                                key={i}
                                src={url}
                                alt="preview"
                                className="h-16 w-16 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImg(url)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Comment Composer */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">Add Response or Work Note:</span>
                  <button
                    type="button"
                    onClick={() => setIsInternal(!isInternal)}
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold border flex items-center gap-1.5 transition-all ${
                      isInternal
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    {isInternal ? 'Internal Only (Hidden from Client)' : 'Public to Client'}
                  </button>
                </div>

                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    isInternal
                      ? 'Add internal investigation notes, debug findings, or staff comments...'
                      : 'Respond directly to client on this ticket...'
                  }
                  rows={3}
                  className={`w-full rounded-md border p-3 text-xs focus:ring-2 focus:ring-primary ${
                    isInternal ? 'bg-amber-50/20 border-amber-200' : 'bg-background'
                  }`}
                />

                {/* Attached previews */}
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {files.map((file, idx) => (
                      <div key={idx} className="relative group">
                        <img src={URL.createObjectURL(file)} alt="thumb" className="h-12 w-12 object-cover rounded border" />
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

                <div className="flex items-center justify-between">
                  <div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Attach Screenshot ({files.length}/10)
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    className={`text-xs h-8 ${isInternal ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                    onClick={() => addMessage.mutate()}
                    disabled={uploading || (!reply.trim() && files.length === 0)}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {isInternal ? 'Save Internal Note' : 'Send Reply'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Jira Attributes Rail (3 Columns / 30%) */}
        <div className="lg:col-span-3 space-y-5">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Issue Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs">
              {/* Status */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                <select
                  value={ticket.status}
                  onChange={(e) => updateTicketField.mutate({ status: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-semibold focus:ring-2 focus:ring-primary"
                >
                  {JIRA_COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Priority</Label>
                <select
                  value={ticket.priority}
                  onChange={(e) => updateTicketField.mutate({ priority: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary font-medium"
                >
                  <option value="Urgent">Highest / Urgent</option>
                  <option value="High">High</option>
                  <option value="Normal">Medium / Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Assignee */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Assignee</Label>
                <select
                  value={ticket.assigned_to || ''}
                  onChange={(e) => updateTicketField.mutate({ assigned_to: e.target.value || null })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {staffMembers?.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.first_name} {staff.last_name || staff.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reporter & Client */}
              <div className="pt-2 border-t space-y-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground block">Client Organization</Label>
                  <Link
                    to={`/app/clients/${ticket.client_id}`}
                    className="font-semibold text-primary hover:underline block mt-0.5"
                  >
                    {ticket.client?.name || 'Internal'}
                  </Link>
                  {ticket.client?.email && (
                    <span className="text-[11px] text-muted-foreground block">{ticket.client.email}</span>
                  )}
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground block">Story Points</Label>
                  <span className="inline-block font-semibold bg-muted px-2.5 py-0.5 rounded text-xs mt-0.5">
                    {ticket.estimate_points || 3} pts
                  </span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="pt-2 border-t space-y-1.5 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="font-medium text-foreground">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Updated:</span>
                  <span className="font-medium text-foreground">
                    {new Date(ticket.updated_at || ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="full-preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 rounded-full"
              onClick={() => setLightboxImg(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" className="text-white bg-white/20 hover:bg-white/30 border-none" asChild>
                <a href={lightboxImg} target="_blank" rel="noopener noreferrer" download>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download Full Image
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
