import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon, X, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ClientTicketView() {
  const { id } = useParams<{ id: string }>();
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [reply, setReply] = useState('');
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['portal_ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
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
        .eq('is_internal', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id
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
          message: reply || 'Attached file(s)',
          is_internal: false,
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
          <Link to="/portal/tickets"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{ticket.title}</h1>
        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-semibold">{ticket.status}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Priority: {ticket.priority} | Category: {ticket.category} | Created: {new Date(ticket.created_at).toLocaleDateString()}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 rounded-lg border">
          {messages?.map((msg: any) => {
            const isMe = msg.user_id === user?.id;
            // Support backwards compatibility for single attachment_url
            const allAttachments = [...(msg.attachments || [])];
            if (msg.attachment_url) allAttachments.push(msg.attachment_url);
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-end gap-2 max-w-[85%] md:max-w-[75%]">
                  {!isMe && (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                      {msg.profile?.first_name?.[0] || 'S'}
                    </div>
                  )}
                  <div className={`p-3 rounded-lg text-sm shadow-sm ${isMe ? 'bg-green-100 dark:bg-green-900 text-foreground rounded-br-none' : 'bg-card border rounded-bl-none'}`}>
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
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ticket.status !== 'Closed' && (
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

              <Button onClick={() => addMessage.mutate()} disabled={addMessage.isPending || uploading || (!reply.trim() && files.length === 0)}>
                {uploading || addMessage.isPending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {ticket.status === 'Closed' && (
        <div className="text-center p-4 bg-muted text-muted-foreground rounded-lg border">
          This ticket has been closed. You cannot send new replies.
        </div>
      )}
    </div>
  );
}
