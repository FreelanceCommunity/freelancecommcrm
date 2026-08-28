import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

export default function ClientMessages() {
  const { organizationId, clientId, user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages for this client
  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat_messages', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_messages')
        .select('*, sender:profiles(first_name, last_name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!clientId) return;

    const subscription = supabase
      .channel('client_chat_updates')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'client_messages',
        filter: `client_id=eq.${clientId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat_messages', clientId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [clientId, queryClient]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (messageText: string) => {
      if (!clientId || !organizationId || !user) return;
      const { error } = await supabase.from('client_messages').insert([{
        organization_id: organizationId,
        client_id: clientId,
        sender_id: user.id,
        message: messageText
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
    }
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
      <div className="p-4 border-b bg-card font-semibold shadow-sm z-10 flex items-center justify-between">
        <h1 className="text-xl">Support & Chat</h1>
        <div className="text-sm text-muted-foreground">Chat with the Team</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-muted/10">
        {isLoading && <div className="text-center text-muted-foreground">Loading messages...</div>}
        {messages?.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground mt-10">
            No messages yet. Send a message to start chatting with our team!
          </div>
        )}
        {messages?.map((msg: any) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                {!isMe && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                    {msg.sender?.first_name?.[0] || 'T'}
                  </div>
                )}
                <div className={`p-3 rounded-lg text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border shadow-sm rounded-bl-none'}`}>
                  {msg.message}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 mx-10">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form 
        onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) sendMessage.mutate(newMessage.trim()); }}
        className="p-4 bg-card border-t flex gap-2"
      >
        <Input 
          value={newMessage} 
          onChange={(e: any) => setNewMessage(e.target.value)} 
          placeholder="Type your message..." 
          className="flex-1"
          disabled={sendMessage.isPending}
        />
        <Button type="submit" disabled={sendMessage.isPending || !newMessage.trim()}>
          <Send className="mr-2 h-4 w-4" /> Send
        </Button>
      </form>
    </div>
  );
}
