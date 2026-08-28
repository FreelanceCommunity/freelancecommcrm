import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminTicketView() {
  const { id } = useParams<{ id: string }>();
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId || !id) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${organizationId}/tickets/${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client-documents').getPublicUrl(fileName);
      setAttachmentUrl(data.publicUrl);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addMessage = useMutation({
    mutationFn: async () => {
      if ((!reply.trim() && !attachmentUrl) || !user) return;
      const { error } = await supabase.from('ticket_messages').insert([{
        ticket_id: id,
        user_id: user.id,
        message: reply || 'Attached an image.',
        is_internal: isInternal,
        attachment_url: attachmentUrl
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setReply('');
      setAttachmentUrl(null);
      queryClient.invalidateQueries({ queryKey: ['ticket_messages', id] });
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
        {ticket.status !== 'Closed' && (
          <Button variant="outline" size="sm" className="ml-auto bg-destructive/10 text-destructive hover:bg-destructive hover:text-white" onClick={async () => {
            if (confirm('Are you sure you want to close this ticket? This will permanently delete all attached images to save storage space.')) {
              // 1. Find all messages with attachments
              const msgsWithAttachments = messages?.filter(m => m.attachment_url) || [];
              if (msgsWithAttachments.length > 0) {
                // Extract file paths from URLs
                const pathsToDelete = msgsWithAttachments.map(m => {
                  const urlParts = m.attachment_url.split('/client-documents/');
                  return urlParts[1];
                }).filter(Boolean);
                
                if (pathsToDelete.length > 0) {
                  // 2. Delete from storage
                  await supabase.storage.from('client-documents').remove(pathsToDelete);
                  // 3. Nullify attachment_url in db
                  await supabase.from('ticket_messages').update({ attachment_url: null }).eq('ticket_id', id);
                }
              }
              // 4. Close ticket
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
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Reported by {ticket.client?.name} | Priority: {ticket.priority} | Category: {ticket.category}
          </div>
          <div className="p-4 bg-muted/30 rounded border">
            {ticket.description || 'No description provided.'}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Conversation</h3>
        {messages?.map(msg => (
          <Card key={msg.id} className={msg.is_internal ? 'border-amber-500/50 bg-amber-500/5' : ''}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {msg.profile?.first_name} {msg.profile?.last_name} {msg.is_internal && <span className="text-amber-600 text-xs ml-2">(Internal Note)</span>}
                </span>
                <span>{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.message}</div>
              {msg.attachment_url && (
                <div className="mt-4 rounded-lg overflow-hidden border max-w-sm">
                  <img src={msg.attachment_url} alt="Attachment" className="w-full h-auto object-cover" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {ticket.status !== 'Closed' ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            {attachmentUrl && (
              <div className="relative inline-block border rounded p-2 bg-muted/50">
                <img src={attachmentUrl} alt="Preview" className="h-20 w-auto rounded" />
                <button 
                  onClick={() => setAttachmentUrl(null)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
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
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Attach Image'}
                  </Button>
                </div>
              </div>

              <Button onClick={() => addMessage.mutate()} disabled={addMessage.isPending || (!reply.trim() && !attachmentUrl)}>
                {addMessage.isPending ? 'Sending...' : 'Send Reply'}
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
