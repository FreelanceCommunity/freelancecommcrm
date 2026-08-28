import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ClientMessages() {
  const { organizationId, clientId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages for this client — oldest first in chat window
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

      // Mark unread as read
      const unreadIds = data.filter(m => !m.read_at && m.sender_id !== user?.id).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      }

      return data || [];
    },
    enabled: !!clientId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!clientId) return;
    const subscription = supabase
      .channel('client_chat_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'client_messages',
        filter: `client_id=eq.${clientId}`,
      }, (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['chat_messages', clientId] });
        // Toast for incoming messages from support
        const incoming = payload.new as any;
        if (incoming && incoming.sender_id !== user?.id && payload.eventType === 'INSERT') {
          toast({ title: '💬 New message from support', duration: 4000 });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [clientId, queryClient, user, toast]);

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
        message: messageText,
      }]);
      if (error) throw error;
    },
    onSuccess: () => setNewMessage(''),
    onError: (err: any) => toast({ title: 'Error sending message', description: err.message, variant: 'destructive' }),
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from('client_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat_messages', clientId] }),
  });

  // Group messages by date
  const groupedMessages = () => {
    if (!messages) return [];
    const groups: { date: string; messages: any[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const msgDate = formatDateSeparator(new Date(msg.created_at));
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-card shadow-sm z-10 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold">Support Chat</h1>
          <p className="text-xs text-muted-foreground">Chat with our team</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1 bg-muted/10">
        {isLoading && <div className="text-center text-muted-foreground text-sm py-8">Loading messages...</div>}
        {!isLoading && messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <MessageSquare className="h-12 w-12 opacity-20 mb-3" />
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Send a message to start chatting with our team!</p>
          </div>
        )}

        {groupedMessages().map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">{date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3">
              {dayMsgs.map((msg: any) => {
                // Client (me) = right side (primary blue), Support/Admin = left (gray card)
                const isMe = msg.sender_id === user?.id;
                const isDeleted = !!msg.deleted_at;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                    <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMe && (
                        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                          {msg.sender?.first_name?.[0] || 'T'}
                        </div>
                      )}
                      <div className="relative">
                        <div className={`p-3 rounded-2xl text-sm shadow-sm break-words ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-card border rounded-bl-sm'
                        }`}>
                          {isDeleted ? (
                            <span className="italic opacity-60 flex items-center gap-1">🚫 Message deleted</span>
                          ) : (
                            msg.message
                          )}
                        </div>
                        {isMe && !isDeleted && (
                          <button
                            onClick={() => deleteMessage.mutate(msg.id)}
                            className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
                            title="Delete for everyone"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1 ${isMe ? 'mr-1' : 'ml-9'}`}>
                      {!isMe && `${msg.sender?.first_name || 'Support'} · `}
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && (
                        <span className={`font-bold tracking-tighter ml-1 ${msg.read_at ? 'text-blue-400' : 'text-muted-foreground/40'}`}>✓✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={e => {
          e.preventDefault();
          if (newMessage.trim()) sendMessage.mutate(newMessage.trim());
        }}
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
    </div>
  );
}
