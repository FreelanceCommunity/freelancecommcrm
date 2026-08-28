import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon, X, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminTicketView() {
  const { id } = useParams<{ id: string }>();
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, client:clients(name)')
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
        .select('*, profile:profiles(first_name, last_name)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id
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
    mutationFn: async (fields: Record<string, string>) => {
      const { error } = await supabase.from('tickets').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (files.length + selected.length > 10) {
        toast({ title: 'Limit exceeded', description: 'You can upload up to 10 images max.', variant: 'destructive' });
        return;
      }
      setFiles(prev => [...prev, ...selected]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addMessage = useMutation({
    mutationFn: async () => {
      if ((!reply.trim() && files.length === 0) || !user || !organizationId) return;
      
      setUploading(true);
      const uploadedUrls: string[] = [];
      
      try {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${organizationId}/tickets/${id}/msg_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket_attachments')
            .upload(fileName, file);
            
          if (uploadError) throw uploadError;
          
          const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(fileName);
          uploadedUrls.push(data.publicUrl);
        }

        const { error } = await supabase.from('ticket_messages').insert([{
          ticket_id: id,
          user_id: user.id,
          message: reply || (isInternal ? 'Attached an internal file.' : 'Attached file(s).'),
          is_internal: isInternal,
          attachments: uploadedUrls
        }]);

        if (error) throw error;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      setReply('');
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['ticket_messages', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  if (isLoading || !ticket) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" asChild>
          <Link to="/app/tickets"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{ticket.title}</h1>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ticket.status === 'Closed' ? 'bg-slate-100 text-slate-600' : 'bg-primary/10 text-primary'}`}>
          {ticket.status}
        </span>
        {/* Status & Priority Controls */}
        <select
          value={ticket.status}
          onChange={e => updateTicketField.mutate({ status: e.target.value })}
          className="ml-2 text-xs rounded border p-1.5 bg-background cursor-pointer"
        >
          {['Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={ticket.priority}
          onChange={e => updateTicketField.mutate({ priority: e.target.value })}
          className="text-xs rounded border p-1.5 bg-background cursor-pointer"
        >
          {['Low', 'Normal', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
        </select>
        {ticket.status !== 'Closed' && (
          <Button variant="outline" size="sm" className="ml-auto bg-destructive/10 text-destructive hover:bg-destructive hover:text-white" onClick={async () => {
            if (confirm('Are you sure you want to close this ticket? This will permanently delete all attached images to save storage space.')) {
              
              // Helper to delete URLs
              const deleteUrls = async (urls: string[]) => {
                const paths = urls.map(u => u.split('/ticket_attachments/')[1]).filter(Boolean);
                if (paths.length > 0) await supabase.storage.from('ticket_attachments').remove(paths);
              };

              // Delete from tickets
              if (ticket.attachments && ticket.attachments.length > 0) {
                await deleteUrls(ticket.attachments);
                await supabase.from('tickets').update({ attachments: '{}' }).eq('id', id);
              }

              // Delete from messages
              const msgsWithLegacy = messages?.filter(m => m.attachment_url) || [];
              const msgsWithMulti = messages?.filter(m => m.attachments && m.attachments.length > 0) || [];
              
              const allMessageUrls: string[] = [];
              msgsWithLegacy.forEach(m => allMessageUrls.push(m.attachment_url));
              msgsWithMulti.forEach(m => allMessageUrls.push(...m.attachments));

              if (allMessageUrls.length > 0) {
                await deleteUrls(allMessageUrls);
                await supabase.from('ticket_messages').update({ attachment_url: null, attachments: '{}' }).eq('ticket_id', id);
              }

              // Close ticket
              await supabase.from('tickets').update({ status: 'Closed' }).eq('id', id);
              queryClient.invalidateQueries({ queryKey: ['ticket', id] });
              queryClient.invalidateQueries({ queryKey: ['ticket_messages', id] });
              toast({ title: 'Ticket Closed', description: 'Ticket closed and attachments deleted to save space.' });
            }
          }}>
            Close Ticket & Purge Attachments
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Reported by {ticket.client?.name} | Priority: {ticket.priority} | Category: {ticket.category}
          </div>
          
          {ticket.app_location && (
            <div className="flex items-center gap-2 text-sm font-medium bg-muted/50 p-2 rounded-md border">
              <MapPin className="h-4 w-4 text-primary" />
              Location in App: <span className="text-muted-foreground font-normal">{ticket.app_location}</span>
            </div>
          )}

          <div className="p-4 bg-muted/30 rounded border whitespace-pre-wrap text-sm">
            {ticket.description || 'No description provided.'}
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Attachments</div>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((url: string, idx: number) => (
                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
                    {url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video src={url} className="h-24 w-auto max-w-[150px] object-cover" />
                    ) : (
                      <img src={url} alt={`attachment-${idx}`} className="h-24 w-auto max-w-[150px] object-cover" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 rounded-lg border min-h-[200px] max-h-[500px]">
          {messages?.map(msg => {
            const isMe = msg.user_id === user?.id;
            
            const allAttachments = [...(msg.attachments || [])];
            if (msg.attachment_url) allAttachments.push(msg.attachment_url);

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-end gap-2 max-w-[85%] md:max-w-[75%]">
                  {!isMe && (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                      {msg.profile?.first_name?.[0] || 'C'}
                    </div>
                  )}
                  <div className={`p-3 rounded-lg text-sm shadow-sm ${msg.is_internal ? 'bg-amber-100 dark:bg-amber-900/40 text-foreground border border-amber-200' : isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border rounded-bl-none'}`}>
                    {msg.is_internal && <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1">INTERNAL NOTE</div>}
                    <div className="whitespace-pre-wrap">{msg.message}</div>
                    
                    {allAttachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {allAttachments.map((url: string, idx: number) => (
                          <a key={idx} href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border bg-background/50">
                            {url.match(/\.(mp4|webm|ogg)$/i) ? (
                              <video src={url} controls className="max-w-xs max-h-40 object-cover" />
                            ) : (
                              <img src={url} alt={`attachment-${idx}`} className="max-w-xs max-h-40 object-cover" />
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className={`text-[10px] text-muted-foreground mt-1 ${isMe ? 'mr-1' : 'ml-10'}`}>
                  {!isMe && `${msg.profile?.first_name || 'User'} • `}
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {ticket.status !== 'Closed' ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 border border-dashed rounded-lg bg-muted/30">
                {files.map((file, idx) => (
                  <div key={idx} className="relative group">
                    {file.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(file)} alt="preview" className="h-16 w-16 object-cover rounded border" />
                    ) : (
                      <div className="h-16 w-16 bg-background rounded border flex items-center justify-center text-[10px] break-all p-1 text-center">
                        {file.name}
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => removeFile(idx)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <textarea
              className="w-full min-h-[100px] p-3 border rounded-md resize-y bg-background"
              placeholder="Type your reply..."
              value={reply}
              onChange={(e: any) => setReply(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isInternal} onChange={(e: any) => setIsInternal(e.target.checked)} />
                  <span>Internal Note (Hidden from client)</span>
                </label>
                
                <div>
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || files.length >= 10}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {files.length > 0 ? `Images (${files.length}/10)` : 'Attach Images'}
                  </Button>
                </div>
              </div>

              <Button onClick={() => addMessage.mutate()} disabled={addMessage.isPending || uploading || (!reply.trim() && files.length === 0)}>
                {uploading || addMessage.isPending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center p-4 bg-muted text-muted-foreground rounded-lg border">
          This ticket has been closed. You cannot send new replies.
        </div>
      )}
    </div>
  );
}
