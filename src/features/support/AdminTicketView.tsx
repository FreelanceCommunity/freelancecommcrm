import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function AdminTicketView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);

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
        .select('*, profile:profiles(first_name, last_name, role)')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const addMessage = useMutation({
    mutationFn: async () => {
      if (!reply.trim() || !user) return;
      const { error } = await supabase.from('ticket_messages').insert([{
        ticket_id: id,
        user_id: user.id,
        message: reply,
        is_internal: isInternal
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setReply('');
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
        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-semibold">{ticket.status}</span>
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
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <textarea
            className="w-full min-h-[100px] p-3 border rounded-md resize-y bg-background"
            placeholder="Type your reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <label className="flex items-center space-x-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
              <span>Internal Note (Hidden from client)</span>
            </label>
            <Button onClick={() => addMessage.mutate()} disabled={addMessage.isPending || !reply.trim()}>
              {addMessage.isPending ? 'Sending...' : 'Send Reply'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
