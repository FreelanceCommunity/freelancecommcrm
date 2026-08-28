import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, User } from 'lucide-react';

export default function AdminMessages() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch clients to chat with
  const { data: clients } = useQuery({
    queryKey: ['chat_clients', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch messages for selected client
  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat_messages', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from('client_messages')
        .select('*, sender:profiles(first_name, last_name)')
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      // Mark unread messages as read
      const unreadIds = data.filter(m => !m.read_at && m.sender_id !== user?.id).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      }
      
      return data || [];
    },
    enabled: !!selectedClientId,
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!selectedClientId) return;

    const subscription = supabase
      .channel('chat_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'client_messages',
        filter: `client_id=eq.${selectedClientId}`
      }, () => {
        // Invalidate query to refetch messages including joined profile data
        queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedClientId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedClientId, queryClient]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (messageText: string) => {
      if (!selectedClientId || !user) return;
      const { error } = await supabase.from('client_messages').insert([{
        organization_id: organizationId,
        client_id: selectedClientId,
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
    <div className="flex h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
      {/* Sidebar for Clients */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-4 border-b bg-muted/50 font-semibold">Chat with Clients</div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {clients?.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedClientId(c.id)}
              className={`w-full flex items-center gap-3 p-3 text-left rounded-md transition-colors ${
                selectedClientId === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <div className={`p-2 rounded-full ${selectedClientId === c.id ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'}`}>
                <User className="h-4 w-4" />
              </div>
              <div className="font-medium truncate">{c.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-muted/10">
        {!selectedClientId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a client to start chatting
          </div>
        ) : (
          <>
            <div className="p-4 border-b bg-card font-semibold shadow-sm z-10 flex items-center justify-between">
              {clients?.find(c => c.id === selectedClientId)?.name}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading && <div className="text-center text-muted-foreground">Loading messages...</div>}
              {messages?.map((msg: any) => {
                const isMe = msg.sender_id === user?.id;
                const isDeleted = !!msg.deleted_at;
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}>
                    <div className="flex items-end gap-2 max-w-[70%]">
                      {!isMe && (
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                          {msg.sender?.first_name?.[0] || 'C'}
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
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
