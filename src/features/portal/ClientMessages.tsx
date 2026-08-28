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
      
      // Mark unread messages as read
      const unreadIds = data.filter(m => !m.read_at && m.sender_id !== user?.id).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      }
      
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
        event: '*', 
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

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from('client_messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId);
      if (error) throw error;
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
          const isDeleted = !!msg.deleted_at;
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}>
              <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                {!isMe && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                    {msg.sender?.first_name?.[0] || 'T'}
                  </div>
                )}
                <div className={`p-3 rounded-lg text-sm shadow-sm ${isMe ? 'bg-green-100 dark:bg-green-900 text-foreground rounded-br-none' : 'bg-card border rounded-bl-none'}`}>
                  {isDeleted ? (
                    <span className="italic text-muted-foreground flex items-center gap-1">
                      <span className="opacity-50">🚫</span> This message was deleted
                    </span>
                  ) : (
                    msg.message
                  )}
                  
                  {/* Delete button (only for own non-deleted messages) */}
                  {isMe && !isDeleted && (
                    <button 
                      onClick={() => deleteMessage.mutate(msg.id)}
                      className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 bg-background/80 rounded p-1"
                      title="Delete for everyone"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1 ${isMe ? 'mr-1' : 'ml-10'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {isMe && (
                  <span className={`font-bold tracking-tighter ml-1 ${msg.read_at ? 'text-blue-500' : 'text-gray-400'}`}>
                    ✓✓
                  </span>
                )}
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
